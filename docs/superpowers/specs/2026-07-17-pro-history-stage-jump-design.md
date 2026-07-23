# 能力训练 Pro 历史角色与阶段跳转设计

## 背景与已验证事实

能力训练 Pro 的页面源 WebSocket 中继已在 yichi Chrome 完成真实端到端验证。用户随后确认两个体验问题：

- Pro 历史记录把角色昵称编码进 `aiText`，历史展示层又统一补 `AI:`，最终产生
  `AI: 小研: 内容`；期望改为 `小研: 内容`，用户侧仍显示 `用户:`。
- Pro 需要与普通能力训练相同的步骤选择入口，并能从指定阶段开始测试。

截图中的连接错误不代表当前端到端失败：截图资源是旧 bundle
`index-pY-0zQI4.js`，当前构建使用 `index-BFNJgCx3.js`。其中
`1000 / client close / wasClean=true` 是正常主动关闭；
`1006 / 请打开能力训练 Pro 页面` 是重载扩展时活动标签不再是训练页产生的旧桥接错误。

`auto_train_pro.py` 已证明 trainV2 协议存在可验证的定向启动路径：新连接仍先发送
`scriptStart`，收到服务端第一次 `nextStep` 后，可以用目标阶段 ID 替换服务端建议的 ID，随后发送
`stepStart`。任意在正在运行的会话中直接发送其它阶段的 `stepStart` 会与服务端当前角色、回合和
`continueCurrentStep` 状态发生竞争，因此不作为产品方案。

## 目标

- Pro 新历史记录使用结构化角色名称，展示和导出时直接显示服务端角色昵称，不再增加 `AI:` 前缀。
- 普通文字训练、口语训练和多角色训练继续使用现有 `AI:` 标签。
- 角色名称随历史同步到 Admin Web，并在网页历史详情及 TXT/ZIP 导出中保持一致。
- Pro 复用普通训练的调试步骤弹窗，选择阶段后关闭旧会话并创建一个从目标阶段启动的新会话。
- 保留旧历史会话；新会话使用新的聊天区域、WebSocket sessionId 和日志 session。
- 正常 WebSocket 关闭不再污染 Chrome 扩展错误页，异常关闭仍保留可操作诊断。

## 非目标

- 不在现有 Pro WebSocket 会话中强制跳转阶段。
- 不修改 Polymas 服务端协议或任务配置。
- 不迁移、猜测或重写已经保存的旧 Pro `aiText`；旧记录保持可读，新记录使用新结构。
- 不改变普通训练的 RunCard 调试语义。
- 不把 Pro 阶段跳转扩展到口语训练或多角色并行训练。

## 方案决策

采用「结构化历史角色 + 新会话定向启动」：

```text
Pro bot/coach turn
  ├─ aiRoleName: nickname / 教练点评
  └─ aiText: 纯发言内容
          │
          ├─ Extension HistoryModal: aiRoleName ?? "AI"
          └─ Admin Web history:     aiRoleName ?? "AI"

用户选择 Pro 目标阶段
  → 校验目标属于当前任务
  → 关闭旧 client，推进 run generation
  → 清空当前聊天，创建新日志 session
  → 新建 trainV2 WebSocket，发送 scriptStart
  → 拦截首次 nextStep，发送 stepStart(targetStepId)
  → 必要时执行阶段开场应答
  → 后续 nextStep 完全服从服务端
```

没有选择目标阶段时，Pro 的现有启动和推进逻辑保持不变。

## 历史记录数据模型

共享 `ChatLogEntry` 增加可选字段：

```ts
interface ChatLogEntry {
  // 现有字段不变
  userText?: string;
  aiText?: string;
  aiRoleName?: string;
}
```

字段语义：

- `aiText` 永远只保存发言正文。
- `aiRoleName` 保存该条非用户发言的显示名称；目前仅 Pro 写入。
- 普通训练不写 `aiRoleName`，展示层回退为 `AI`。
- 用户侧继续由 `userText` 表示，并固定显示 `用户:`。
- Pro bot 写入 `aiRoleName=<resolved nickname>`。
- `roleNid === "system"` 的教练点评写入 `aiRoleName="教练点评"`。

Admin Web 的 Zod schema 必须接受该可选字段。D1 保存的是历史 JSON，不需要数据库迁移。旧记录没有该字段时继续回退显示 `AI:`。

## Pro 角色名解析

对空字符串做 trim 后，按以下顺序取第一个非空值：

1. 当前 `botAnswerEnd` 或 `selectRoleEnd` 事件的 `roleNickname`；
2. 当前阶段角色表中同 `roleNid` 的 `nickname`；
3. 事件的 `roleName` 或当前已选择角色的 `roleName`；
4. 固定回退 `对方`。

为支持第二级回退，Pro 阶段上下文中的参与角色保留 `nid`。角色解析封装为纯函数，聊天气泡、LLM 历史和持久化日志使用同一个结果，避免三条链路出现不同名称。

## 扩展与 Admin Web 展示

扩展历史弹窗和 TXT 导出统一使用：

```ts
const aiLabel = entry.aiRoleName?.trim() || 'AI';
```

示例：

```text
Step: 阶段 2 | step_id: pOsp2yWp3b | 第 12 轮 | 来源: chat
小研: 好的，如果预算有限……
用户: 我会优先保障低温管理……
```

Admin Web 的历史详情、单条 TXT 下载和批量 ZIP 中的 TXT 使用相同回退规则。API 上传、下载和本地合并不新增分支，只让 schema 保留新字段。

模拟对话配置当前以 `AI:` / `用户:` 作为粘贴格式。本次不扩展该解析器；结构化的 Pro 历史仍保存在 storage 中，用户要求的历史查看和导出优先交付。若后续要求把带任意角色昵称的 Pro TXT 重新导入模拟对话，再单独定义无歧义的解析规则。

## Pro 阶段列表与 UI

`fetchProTrainingContext()` 已从
`/ai-platform/ability-train/steps/list?taskId=...` 获取 `nid / stepName / description`。Hook 将阶段按接口顺序暴露为只读列表：

```ts
interface ProDebugStage {
  stepId: string;
  stepName: string;
  description: string;
}
```

Side Panel 继续复用 `DebugStepsModal`，但把弹窗输入收敛为普通训练和 Pro 都能提供的通用步骤视图。普通训练仍过滤 `SCRIPT_START / SCRIPT_END`；Pro 接口只提供可运行阶段，不伪造节点类型。

Pro 运行中显示现有「调试模式 / 选择步骤快速跳转」按钮。连接中或正在切换阶段时按钮禁用。用户选择阶段后立即关闭弹窗并进入新会话定向启动流程。

## 新会话定向启动状态流

Hook 对外增加 `restartAtStage(stepId)`，内部复用统一的启动函数，不复制 `start()` 的用户、上下文、日志和 WebSocket 初始化逻辑。

1. 确认 `trainTaskId` 存在，目标 `stepId` 属于当前任务的阶段列表；校验失败时保留当前会话并显示错误。
2. 停止自动回答，调用现有 teardown：先推进 `runSeq`，再关闭旧 client，使旧回调和迟到 close 全部失效。
3. 清空当前聊天和回合状态，但不删除或修改旧日志 session。
4. 重新刷新用户信息与 Pro 上下文，确认目标阶段在最新列表中仍存在。
5. 创建新的日志 session、新的 WebSocket sessionId，并记录系统消息
   `调试模式：从阶段 <stepName> 开始`。
6. 连接成功后仍先发送 `scriptStart`。
7. 仅在本次会话收到第一次 `nextStep` 时，以目标 `stepId` 代替服务端的 `nextStepId`，随后发送
   `stepStart { stepId: target }`。目标消费后立即清空，后续 `nextStep` 不再拦截。
8. 定向目标按非首阶段处理：沿用现有安静检测、`userTextInput("好的")` 与
   `continueCurrentStep` 重试机制，直到角色开始发言或现有超时策略失败。
9. 角色开始发言后进入正常 Pro 回合；脚本后续阶段完全服从服务端。

每次定向启动只允许一个目标，且由当前 `runSeq` 绑定。切换任务、重置、停止或组件卸载都会清除未消费目标。

## 错误处理与诊断

- `code=1000 && wasClean=true` 属于正常主动关闭，不使用 `console.warn`；使用 debug 级别或不输出。
- `error` 事件继续记录阶段信息，但不把不透明事件对象作为第二参数输出，避免 Chrome 错误页出现 `[object Object]`。
- 非正常 close 继续用 warning 输出 `code / reason / wasClean / phase`。
- 目标阶段在关闭旧会话前失效：保留旧会话并提示刷新阶段列表。
- 目标在刷新上下文后失效：新会话不连接，进入明确错误态，可重新选择。
- 页面 relay、握手或服务端拒绝失败：使用现有 Pro 失败收尾；旧日志仍保留，新日志保留已经发生的系统/对话记录。
- 定向 `stepStart` 后阶段多次开场仍无角色推进：进入现有错误态，不自动回退到服务端建议阶段，避免用户误以为正在测试目标阶段。

## 兼容与安全

- 新历史字段可选，旧扩展和旧云端数据仍可读取。
- 不根据可编辑任务名后缀判断 Pro，也不解析 `aiText` 的第一个冒号猜角色。
- 目标 stepId 必须来自当前任务的最新 Pro 步骤列表；不会把任意 stepId 发送给页面 relay。
- 页面 relay 的 `stepStart` 白名单和 payload 校验保持不变，不增加新的出站事件。
- 切换阶段仍创建全新的随机 WebSocket sessionId，不复用服务端会话状态。
- 不新增 Chrome 权限、依赖或后台数据通道。

## 测试策略

按测试先行分层覆盖：

1. **历史映射纯函数**
   - Pro 用户只生成 `userText`。
   - Pro bot 生成纯 `aiText` 和 `aiRoleName=nickname`。
   - 教练生成 `aiRoleName=教练点评`。
   - 事件昵称为空时按阶段昵称、角色名、`对方` 回退。
2. **历史展示与同步**
   - 扩展普通记录仍导出 `AI:`，Pro 导出昵称且不出现 `AI: 昵称:`。
   - Admin Web schema 保留 `aiRoleName`，并接受没有该字段的旧数据。
   - Admin Web 页面及 TXT/ZIP 使用相同标签回退。
3. **定向启动纯状态逻辑**
   - 未指定目标时使用首个服务端 `nextStepId`。
   - 指定目标时只替换第一次 `nextStep`，后续不替换。
   - 无效目标在关闭旧 client 前被拒绝。
   - teardown、任务变化和 run generation 变化清除目标。
4. **Hook 行为**
   - 选择阶段关闭旧 socket、清空当前 UI、创建新日志 session。
   - 旧 socket 回调不能污染新会话。
   - 定向阶段触发现有阶段开场应答；自然首阶段行为不变。
5. **回归与真实验证**
   - storage、side-panel 和 admin_web 的 scoped test/lint/type-check/build。
   - 根工作区生产构建。
   - yichi Chrome：普通启动成功；选择第二阶段后出现新的历史会话，第一条业务阶段为目标阶段，并完成至少一个学生回合；普通文字训练调试跳转不变。

## 验收标准

- 新 Pro 历史在扩展和 Admin Web 均显示 `nickname: content`，没有额外 `AI:`。
- 用户行仍显示 `用户:`；普通训练仍显示 `AI:`。
- 登录同步后 `aiRoleName` 不丢失，旧历史仍可查看。
- Pro 可通过现有调试入口选择任意当前任务阶段。
- 选择阶段会停止旧会话、保留旧历史并创建新历史；当前聊天清空。
- 新 WebSocket 首次 `nextStep` 被目标替换一次，后续流程正常推进。
- 无效目标、连接失败和阶段启动失败都有明确错误，不发生旧新会话串线。
- 正常 `1000` 关闭不再出现在 Chrome 扩展错误列表；异常 close 仍有完整诊断。

## 备选方案及取舍

### 仅在首次开始前选择阶段

状态最简单，但用户完成一段对话后无法快速换阶段，且与普通训练的调试体验不一致，因此不采用。

### 当前会话直接发送目标 `stepStart`

表面上切换更快，但 trainV2 服务端当前角色和 continue 状态仍属于旧阶段，容易出现
`continueSuperseded`、重复角色或阶段死锁，因此不采用。

### 客户端伪造阶段 UI，不改变服务端步骤

只能改变提示词和显示，实际服务端仍运行原阶段，测试结果不可信，因此不采用。
