# 统一训练空闲态设计

## 目标

让能力训练、口语训练和能力训练 Pro 在尚未开始训练时显示完全一致的内容结构。模式差异只通过 Header 下拉框展示；训练开始后仍进入各模式现有的独立运行流程。

## 统一范围

三种模式的空闲态统一显示：

- 对话模拟 / 知识库配置入口。
- 模拟对话和知识库开关。
- 相同样式及文案的开始训练按钮。
- 缺少 `trainTaskId` 时相同的禁用状态和提示。

Header 标题在三种模式下均显示“能力训练助手”。当前模式只由下拉框中的“能力训练”“口语训练”或“能力训练 Pro”标识。

## 组件设计

在 `SidePanel.tsx` 中新增本地共享组件 `IdleTrainingPanel`。该组件只负责空闲态展示，接收：

- `simulationConfig`：模拟对话和知识库配置。
- `onToggleSimulation`、`onToggleKnowledge`、`onOpenSimulationConfig`：配置交互回调。
- `onStart`：当前模式的启动回调。
- `isLoading`：加载及禁用状态。
- `trainTaskId`：控制开始按钮可用性及缺失任务提示。

组件内部复用现有 `SimulationConfigBar` 和 `StartButton`，不复制按钮样式或提示文案。

## 数据流

- 能力训练和能力训练 Pro 的空闲态将 `startConversation` 传给 `IdleTrainingPanel.onStart`。
- 口语训练的空闲态将 `voice.startSession` 传给 `IdleTrainingPanel.onStart`。
- 三种模式继续共享 `simulationConfig` 及其配置回调。
- 口语状态进入连接中、已连接或后续状态后，继续渲染现有语音状态栏、输入框、TTS 和自动运行控件。

## 边界与异常

- 不修改 `useAgentChat`、`useVoiceAgentChat` 或多角色训练 hook。
- 不改变任何训练状态机、存储字段或后端请求。
- 口语模式处于 `ERROR` 时仍回到统一空闲态，允许用户使用相同的开始按钮重新连接。
- 训练进行中仍禁止切换模式。

## 验证

- 三种模式空闲态均只通过 `IdleTrainingPanel` 渲染。
- Header 标题在三种模式下保持一致，只有下拉框文案不同。
- 文字与 Pro 启动普通训练，口语启动语音会话。
- 缺少 `trainTaskId` 时三种模式显示相同禁用按钮和提示。
- 运行 sidepanel lint、类型检查和生产构建。

## 非目标

- 不统一训练开始后的文字与语音交互界面。
- 不改变能力训练 Pro 暂时复用文字训练的行为。
- 不新增依赖、存储字段或后端接口。
