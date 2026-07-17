# 能力训练 Pro 页面源 WebSocket 中继设计

## 背景与已验证事实

能力训练 Pro 目前由 Side Panel 直接创建
`wss://cloudapi.polymas.com/ai-platform/ws/trainV2` 连接。yichi Chrome 账号实测表明：

- 教学页面左下角「测试」使用
  `taskId=PROuNODZ41RAJttrEuzs`、`userId=Rkpo11KSW2` 时，握手返回 `101`；随后依次发送
  `scriptStart` 并收到 `connected`、`nextStep`。
- 插件使用相同的任务、用户及协议顺序，却在 `open` 事件前触发 `error`，最终得到浏览器合成的
  `1006`。
- 网页成功请求的 `Origin` 是
  `https://hike-teaching-center.polymas.com`；Side Panel 直连由
  `chrome-extension://...` 发起。浏览器 `WebSocket` 构造器不允许调用方覆盖 `Origin` 或附加任意握手头。
- 当前日志用 Promise 是否已结算的 `settled` 推断连接阶段。`error` 先把它设为 `true`，随后
  `close` 因而被误记为 `phase=connected`；该日志不代表连接曾经打开。
- Polymas 用户信息成功后被永久缓存。切换 BIT 账号而不重载扩展时，仍存在把旧
  `userId` 带入下一次连接的独立风险；本次 yichi 实测的 ID 一致，因此它不是当前握手失败的主因。

## 目标

- 让 trainV2 WebSocket 在 Polymas 教学页面的主世界中建立，使握手 Origin 与网页官方测试一致。
- 保留 `TrainV2Client`、`useProAgentChat` 的协议和业务状态机职责，不把训练逻辑搬进页面脚本。
- 建立受限、可验证、随页面生命周期自动断开的 Side Panel ↔ 页面传输通道。
- 修复连接阶段诊断、账号切换缓存及任务 URL 切换兼容问题。
- 不影响普通文字训练、口语训练及 Admin Web 通道。

## 非目标

- 不修改 Polymas 服务端，也不新增 wsTicket 接口。
- 不通过 DNR 或 `webRequest` 篡改 `Origin`、Cookie 或 Authorization。
- 不播放 trainV2 的二进制 TTS 帧。
- 不改变 Pro 的回合推进、AI 学生回答、历史记录和现有 UI。
- 不把 WebSocket 移到 Background；Background 仍然不是页面 Origin。

## 方案决策

采用「页面主世界 WebSocket + 隔离世界中继 + Side Panel Port」：

```text
useProAgentChat / TrainV2Client
        │  WebSocket-like adapter
        ▼
Side Panel background-bridge
        │  chrome.tabs.connect(frameId=0)
        ▼
ISOLATED content bridge
        │  window.postMessage（严格 envelope 校验）
        ▼
MAIN world WebSocket host
        │  Origin = https://hike-teaching-center.polymas.com
        ▼
cloudapi.polymas.com/ai-platform/ws/trainV2
```

静态 content script 只注入
`https://hike-teaching-center.polymas.com/*`。两个无 UI 的独立 entry 分别在 `MAIN` 和
`ISOLATED` world 执行，共用 content 工作区内的窄协议模块：

- `MAIN` world 只持有 WebSocket、校验命令并转发 JSON 安全的事件。
- `ISOLATED` world 只持有 Chrome Port、校验 window 消息并做双向转发。
- Side Panel 仍负责心跳、协议事件分发和训练状态机。

不保留 Side Panel 直接 `new WebSocket()` 的运行时兜底。页面桥接不可用时明确提示刷新训练页面，避免用已知错误路径产生模糊的 `1006`。

## 组件与职责

### 1. Manifest 与静态 content script

在 `chrome-extension/manifest.ts` 增加两条静态 content script 声明：

- match：`https://hike-teaching-center.polymas.com/*`
- `run_at: document_start`
- `content/pro-train-v2-main.iife.js` 使用 `world: MAIN`
- `content/pro-train-v2-relay.iife.js` 使用 `world: ISOLATED`
- 默认只进入顶层 frame

在 `pages/content/src/matches/pro-train-v2-main/` 与
`pages/content/src/matches/pro-train-v2-relay/` 增加无 React、无 DOM UI 的入口，并在
`pages/content/src/pro-train-v2-relay-protocol.ts` 集中协议常量、固定 URL 构造和纯校验函数，避免两个 world 重复实现。构建沿用仓库现有静态 content script 工作区，不新增依赖或 `scripting` 权限；`pages/content-runtime` 继续只用于显式的运行时注入，不参与本功能。

### 2. MAIN world WebSocket host

职责仅限：

- 接收经过校验的 `CONNECT / SEND / CLOSE` 命令。
- 只允许连接固定的 `wss://cloudapi.polymas.com/ai-platform/ws/trainV2`。
- 校验 query 中恰好包含非空的 `taskId / userId / sessionId`，且 Pro 任务 ID 以 `PRO` 开头。
- 校验 `CONNECT.taskId` 与当前教学页面 URL 的 `trainTaskId` 或 `taskId` 相同，避免借当前标签启动其它任务。
- `SEND` 只允许现有出站事件：
  `scriptStart`、`stepStart`、`userTextInput`、`continueCurrentStep`、`heartBeat`；并校验各自 payload 形状。
- 文本帧原样转成 JSON 安全消息；二进制帧只上报 `byteLength`，不跨 Chrome Port 传音频内容。
- 每个 `connectionId` 最多一个 socket。重复连接先关闭旧 socket。
- 页面卸载、Side Panel Port 断开或收到 `CLOSE` 时关闭 socket。

它不接收任意 URL、不读取 Cookie、不暴露 token，也不执行页面传来的代码。

### 3. ISOLATED content bridge

职责仅限：

- 只接受名称固定的 `chrome.tabs.connect` Port。
- 记录每个 Port 创建的 `connectionId`；Port 断开时逐个通知主世界关闭对应 socket。
- window 消息必须满足：
  `event.source === window`、`event.origin` 为教学中心 origin、协议版本正确、方向正确、
  `connectionId` 属于当前 Port。
- 仅转发白名单事件，不信任页面构造的任意对象。

### 4. Side Panel 页面源适配器

Background 只新增 `GET_CURRENT_TAB_INFO`，返回活动标签的 `id/url`，并严格校验
协议与 hostname；它不转发任何
WebSocket 数据；由 Side Panel 直接连接 content script，避免让长连接依赖 MV3 Service Worker 生命周期。

在 Side Panel WS 服务层新增 WebSocket-like adapter：

- `background-bridge.ts` 先查询当前活动标签，再执行
  `chrome.tabs.connect(tabId, { name, frameId: 0 })` 并返回 Port；业务 hook 和适配器不直接调用 `chrome.*`。
- 向 content bridge 发送连接参数，并把 `OPEN / TEXT / BINARY / ERROR / CLOSE`
  转换成 `TrainV2Client` 所需的最小 socket 事件。
- 保持标准 `readyState` 语义；未打开时拒绝 `send`，关闭操作幂等。
- Port 建立失败时抛出可操作错误：
  「未检测到 Pro 页面连接桥，请刷新当前训练页面后重试」。
- 标签页刷新、导航或关闭导致 Port 断开时，向客户端报告页面连接中断，而不是静默重连到其它标签页。

`TrainV2Client` 保留 URL 生成、心跳、`scriptStart`、消息分发和活动序号；仅把底层 socket 创建替换为页面源适配器。

### 5. 账号与 URL 生命周期修复

- `fetchPolymasUserInfo` 支持显式强制刷新；每次 Pro `start()` 都获取当前账号，而不是永久复用旧 Promise。
- Pro 握手失败时清除用户缓存，下一次重试重新读取账号。
- URL 变化统一通过现有 `readTaskIdFromUrl` 语义处理 `trainTaskId` 与 `taskId`，避免 Side Panel 打开后切换 Pro 页面仍使用旧任务。

## 消息协议

所有消息都是 JSON 可序列化的窄类型对象，并带：

- `protocol: "polymas-pro-train-v2"`
- `version: 1`
- `direction: "extension-to-page" | "page-to-extension"`
- `connectionId: string`（每次客户端实例使用随机 128-bit URL-safe 值）
- `type` 与对应 payload

扩展到页面：

- `CONNECT { taskId, userId, sessionId }`
- `SEND { data }`
- `CLOSE { code, reason }`

页面到扩展：

- `OPEN`
- `TEXT { data }`
- `BINARY { byteLength }`
- `ERROR`
- `CLOSE { code, reason, wasClean }`

不在协议中传 Cookie、Authorization、用户配置、LLM 密钥或聊天历史。

## 连接状态与错误处理

- `TrainV2Client` 分离 `opened` 与 Promise `settled`：
  `phase=handshake` 仅表示从未收到 OPEN，`phase=connected` 仅表示曾收到 OPEN。
- `1006` 描述为「未收到标准关闭帧」，不再直接写成「服务器拒绝握手」。
- 10 秒内未收到页面 `OPEN`：关闭对应 connection，报告握手超时。
- 页面桥接未注入：立即给出刷新页面提示，不自动使用扩展源直连。
- 扩展升级或重新加载后，已打开的教学页不会自动补注入静态 content script；用户只需刷新该教学页一次，后续连接不再要求额外操作。
- 端口断开：停止心跳并触发现有 Pro 失败收尾；已产生对话仍按现有逻辑写历史。
- 用户停止或 hook 卸载：幂等发送 `CLOSE`、断开 Port、清除定时器。
- 收到未知、越权或不合法消息：丢弃并记录不含敏感字段的开发日志，不执行任何动作。

## 安全边界

- content script 只匹配固定 HTTPS 教学中心域名。
- WebSocket host/path 固定，页面不能借桥接请求任意地址。
- 出站事件及 payload 均为白名单。
- 所有来自 content script / 页面主世界的数据在进入扩展状态机前进行结构校验。
- 使用 `textContent`/对象数据流，不引入 HTML 注入或 `eval`。
- 使用 exact origin 的 `window.postMessage`，并校验 `source/origin/direction/version/connectionId`。
- Content bridge 不获得 Admin Web bearer token、Polymas Cookie 或 LLM 配置。

## 测试策略

按测试先行分四层实现：

1. **页面 host 纯逻辑测试**
   - 拒绝非固定 host/path、非 Pro taskId、缺失参数。
   - 拒绝与当前页面 URL 不一致的 taskId。
   - 只接受五种出站协议事件及合法 payload。
   - 文本、二进制、close/error 事件转换正确。
2. **Side Panel adapter 测试**
   - `CONNECT → OPEN → SEND → CLOSE` 状态迁移。
   - Port 断开、桥接缺失、超时、重复 close 的行为。
   - 非当前 `connectionId` 和畸形消息被忽略。
3. **现有客户端回归测试**
   - `scriptStart` 仍在 OPEN 后立即发送。
   - 心跳与所有 trainV2 事件分发不变。
   - `opened` 与 `settled` 不再混淆连接阶段。
   - Pro start 强制刷新 userInfo，失败后 invalidate。
4. **构建与真实回归**
   - 通过 Node `node:test` + FakeSocket/FakeWindow/FakePort 覆盖纯控制器和边界适配器，不引入 jsdom/Vitest。
   - side-panel、content、chrome-extension 的 lint/type-check。
   - 根工作区生产构建，确认生成 manifest 有两条 bridge content scripts。
   - yichi Chrome 真实 Pro 页面：插件 trainV2 握手返回 `101`，完成至少一个学生回合；停止、重试、刷新页面后均可恢复。
   - 普通文字与口语模式冒烟检查，确认没有建立 Pro bridge 连接。

## 验收标准

- yichi Chrome 中能力训练 Pro 不再出现握手期 `1006`，Network 显示 trainV2 `101`。
- 插件能收到 `connected / nextStep` 并按原逻辑推进。
- 页面官方「测试」与插件可分别启动，connectionId 隔离，不互相串消息。
- 切换 BIT 账号后下一次 Pro start 使用新 userId。
- 切换到另一个 `taskId` 或 `trainTaskId` 后不复用旧任务。
- 页面刷新/关闭时插件给出明确错误并可重试，无定时器或 Port 泄漏。

## 备选方案及取舍

### 服务端 wsTicket（长期最优）

由已鉴权 REST 返回短期 wsTicket，并允许扩展 Origin。安全边界最清晰，但需要 Polymas 后端配合，本仓无法独立交付。

### Background WebSocket

实现简单，但 Origin 仍是扩展源，不能解决已验证差异，因此不采用。

### DNR/webRequest 修改请求头

对浏览器版本、权限及不可变 initiator 行为敏感，还会扩大敏感请求头修改能力，不采用。

### 保留直连并自动重试

不会改变握手条件，只会重复制造 `1006`，不采用。
