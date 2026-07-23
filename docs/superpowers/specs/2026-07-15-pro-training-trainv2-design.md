# 能力训练 Pro（trainV2）集成设计

## 目标

将 `auto_train_pro.py` 已验证的 trainV2 WebSocket 协议移植进侧边栏，使「能力训练 Pro」模式从"复用文字训练的占位入口"变为真正的多角色剧本训练：连接 `wss://cloudapi.polymas.com/ai-platform/ws/trainV2`，以半交互（手动输入 / AI 生成）+ 可切全自动的方式完成学生回合，训练结束后写入历史记录。

参考实现为仓库外脚本 `auto_train_pro.py`（trainV2 协议测试工具），其协议要点、阶段握手死锁修复与防失控机制均由 HAR 录制与实测验证，本设计原样移植这些协议逻辑。

## 已确认的决策

- 交互形态：半交互 + 可切全自动（对齐脚本行为与现有文字训练体验）。
- 服务端 TTS 音频帧（MP3 二进制）：本期直接丢弃，纯文字界面。
- 集成方式：独立 Pro 链路（新 WS 客户端 + 新 hook），不侵入任何现有训练状态机。

## 架构与数据流

```
Pro 训练页 URL (trainTaskId=PROxxx)
        │ background 现有 trainTaskId 提取逻辑（复用）
        ▼
IdleTrainingPanel（复用）── onStart ──▶ useProAgentChat（新增）
                                          │
                    ┌─────────────────────┼──────────────────────┐
                    ▼                     ▼                      ▼
        fetchPolymasUserInfo（复用）  TrainV2Client（新增）   generateStudentAnswer（复用）
        取 userId                    trainV2 传输层           AI 学生作答
                                          │
                                          ▼
                              SidePanel pro 运行分支（新增 UI）
                              多角色气泡 + 教练点评 + 学生输入区
                                          │ scriptEnd / 手动停止
                                          ▼
                              agentLogStorage（复用，进历史）
```

- 连接 URL：`wss://cloudapi.polymas.com/ai-platform/ws/trainV2?taskId=…&userId=…&sessionId=…`。
- `userId` 来自 `fetchPolymasUserInfo()`（userNid）；`sessionId` 由前端随机生成（21 位 URL-safe 随机串，对齐脚本）。
- 浏览器 WebSocket 握手自动携带 polymas.com Cookie（现有 trainFlow 客户端已验证此路径），无需手动附加 Cookie/Authorization。

## 组件设计

### TrainV2Client（新文件 `pages/side-panel/src/services/ws/train-v2-client.ts`）

纯传输层，结构对齐现有 `training-ws-client.ts`，不含业务状态：

- 连接成功后立即发送 `scriptStart`。
- 类型化事件回调：`connected / nextStep / selectRoleStart / selectRoleEnd / botAnswerStart / botAnswer / botAnswerEnd / continueSuperseded / stepEnd / scriptEnd / error`，另有 `onOpen / onClose / onUnknownEvent`。
- 二进制帧（TTS MP3）直接丢弃，但计入活动序号——这是阶段握手"等安静"判定的必要输入。
- 应用层心跳每 30s（脚本实测值；与 trainFlow 的 20s 无关，两端点服务器不同）。
- 发送顺序由浏览器 `WebSocket.send` 同步入队天然保证，无需额外队列（脚本的 `_ws_send_lock` 解决的是 Python 异步发送交错问题，浏览器端不存在）。
- 握手超时 10s。

### useProAgentChat（新文件 `pages/side-panel/src/hooks/useProAgentChat.ts`）

Pro 状态机：`IDLE → CONNECTING → RUNNING（子状态 WAITING_BOT / USER_TURN / STAGE_ENTRY）→ COMPLETED / ERROR`。

事件处理规则（照搬脚本已验证逻辑）：

| 事件 | 动作 |
| --- | --- |
| `connected` | 记录连接信息 |
| `nextStep` | 记录 `nextStepId`、阶段序号 +1，回发 `stepStart{stepId}`；阶段序号 ≥2 时启动阶段开场应答流程 |
| `selectRoleEnd` | `roleNid == "user"` → 学生回合；其它 → 等待该角色发言 |
| `botAnswerStart` | 标记"本阶段已启动"（供开场应答重试判定） |
| `botAnswer` | 忽略流式分片，统一用 `botAnswerEnd` 整句 |
| `botAnswerEnd` | 取 `content` 入对话流（`roleNid == "system"` 标记为教练点评），回发 `continueCurrentStep` |
| `continueSuperseded` | 标记开场应答被拒，触发重试 |
| `stepEnd` | 仅作标记 |
| `scriptEnd` | 训练完成：写历史、断开、状态 COMPLETED |
| `error` | 状态 ERROR：写已有对话到历史、断开、提示 |

关键机制（均移植自脚本）：

1. **非首阶段开场应答**：`stepStart` 后服务端停在 `selectRoleStart` 等学生先应答。流程：等安静（连续 2.5s 无任何事件/音频帧）→ 发"好的"+ `continueCurrentStep` → 等 `botAnswerStart`（60s 超时）；收到 `continueSuperseded` 或超时则重试，上限 12 次，仍失败置 ERROR。无论半交互还是全自动，开场应答均自动发送并显示在对话流中——它是协议解锁动作而非教学回合，不打断用户。
2. **全自动轮数上限**：40 轮，达到即主动结束并提示，防失控刷 LLM。
3. 上述数值（2.5s / 60s / 12 次 / 40 轮 / 30s 心跳 / 10s 握手超时）以命名常量定义在各自文件顶部，不做用户可配置项。

### 学生回合与 AI 作答

- 半交互：轮到学生时输入区可用——手动输入发送，或点「AI 生成」，或打开「自动运行」开关（本轮起全部 AI 作答，可随时关闭）。
- 发送路径：`userTextInput{text}` → `continueCurrentStep`。
- AI 作答复用现有 `generateStudentAnswer(aiQuestion, history, runtimeOverride)`，`llm-service` 零改动。多角色历史映射：
  - `aiQuestion` = 自上次学生发言以来的所有非学生发言拼接，每句带角色名标签，教练点评标 `[教练点评]`。
  - `history` = 既往回合按 `{ai, student}` 对传入（ai 侧为该回合前的非学生发言拼接）。
  - 学生档位、模拟对话、知识库经由现有 `llmConfigStorage` 配置体系自然生效。
  - 若实测生成质量不足，后续再考虑 Pro 专用 prompt 构造器，不在本期。

## UI 设计（`SidePanel.tsx` 的 `pro` 分支）

- 空闲态：复用统一 `IdleTrainingPanel`，`onStart` 接 `useProAgentChat.start`；缺 `trainTaskId` 的禁用与提示行为与其它模式一致。
- 消息流：沿用现有聊天气泡的渐变、不对称圆角与动画。差异仅两点：
  - bot 气泡上方显示角色昵称标签（多角色剧本，不同角色轮流出场）。
  - `system` 教练点评用区别样式：淡色卡片 + "教练点评"标签，与对话气泡明显区分。
- 学生输入区：文本框 + 发送、「AI 生成」按钮、「自动运行」开关。非学生回合禁用并显示"等待〈当前角色昵称〉发言…"。自动运行开关为运行时状态，不持久化。
- 顶部轻量状态条：当前阶段序号 + 连接状态，右侧放「停止」按钮。
- 「停止」按钮：训练中可手动结束——断开 WS、已有对话写入历史、回到空闲态。
- COMPLETED：消息流末尾显示完成提示，界面回到空闲态样式，可直接开始新一轮训练。
- 训练进行中禁用模式切换（沿用现有规则）。

## 历史记录

`scriptEnd` 或手动停止时写入 `agentLogStorage` 一条记录：多角色发言以"角色名: 内容"、教练点评以"[教练点评] 内容"形式存入消息 content，学生发言按现有用户消息格式存入。不改 `AgentLogEntry` schema，与现有历史查看/导出 UI 兼容。

## 错误处理

- 握手失败 / 10s 超时 / `error` 事件 / 连接意外关闭：状态 ERROR，提示原因，回到统一空闲态，可用同一开始按钮重连；已产生的对话照常写历史。
- 开场应答重试 12 次仍未启动阶段：ERROR，提示"服务端可能异常"。
- LLM 生成失败：半交互下提示错误，用户可手动输入或重试；全自动下自动暂停并退回半交互（不静默发送兜底假答案，此处有意区别于脚本行为）。

## 验证

- `pnpm -F @extension/sidepanel lint`。
- `pnpm -F @extension/sidepanel type-check`。
- 根工作区生产构建。
- 手动 e2e（真实 Pro 任务页，URL 含 `trainTaskId=PRO…`）三条路径：
  - 全自动跑完整个剧本，确认多阶段推进、教练点评展示、历史记录生成。
  - 半交互：手动输入与「AI 生成」混合作答，确认回合规则正确。
  - 中途停止：确认断开干净、部分对话进历史、可重新开始。

## 非目标

- 不播放服务端 TTS 音频，不做语音输入。
- 不修改 `useAgentChat`、`useVoiceAgentChat`、`useMultiRoleRun` 及 trainFlow WS 客户端。
- 不新增存储 schema 字段，不持久化自动运行开关。
- 不修改 Admin Web、配置同步或后端。
