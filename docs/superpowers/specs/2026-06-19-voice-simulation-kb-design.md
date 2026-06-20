# 设计文档：将「模拟对话 / 知识库」迁移到口语训练模式

- 日期：2026-06-19
- 状态：已确认设计，待写实现计划
- 范围：`pages/side-panel/src/`

## 1. 背景与目标

文字模式（能力训练）有三项专属功能：调试模式、模拟对话、知识库。口语模式（WS 语音训练）目前只暴露了「全自动 / AI 自动生成 / 发送」。本次目标是把**模拟对话**与**知识库**的配置入口补到口语模式，使口语用户无需切回文字模式即可配置并启用这两项能力。

## 2. 关键发现（决定本设计为何如此轻量）

模拟对话与知识库的**运行逻辑已经在口语模式生效**，无需新增逻辑：

- 口语「AI 自动生成 / 全自动」走 `useVoiceAgentChat.autoGenerate()` → `generateStudentAnswer()`（`services/llm-service.ts:516` 调用链）。
- `generateStudentAnswer()` → `buildStudentRoleSystemPrompt(systemPrompt, profile, config)`（`llm-service.ts:660`）。
- `buildStudentRoleSystemPrompt()` 已从全局 `llmConfigStorage` 读取并注入 `dialogueSimulationContent` 与 `knowledgeBaseContent`（`llm-service.ts:502–538`）。
- 配置存于全局 `llmConfigStorage`，文字 / 口语两模式共享。

因此本次工作的本质是 **UI 暴露**，不是迁移逻辑。

## 3. 范围

**纳入：**
- 在口语视图增加「对话模拟 / 知识库」配置入口（打开既有 `SimulationConfigModal`）。
- 在口语视图增加「模拟对话」「知识库」两个启用开关（含「内容为空 / 未识别」提示）。

**排除：**
- 调试模式：本期搁置（WS 为服务端驱动，能否跳到任意 step 属服务端协议未知数，需真机实测后再单独排期）。
- 多角色并行：明确不做。

**自动带过去、无需单独开发：** 学生档位、系统提示词、分阶段生成——均通过共享 `llmConfigStorage` 已经对口语模式生效。

## 4. 设计

采用「抽共享组件」方案（评审选定方案 A）。

### 4.1 新增组件 `components/SimulationConfigBar.tsx`

从文字模式 `ChatInput`（`SidePanel.tsx:522–559`）抽出「模拟对话 / 知识库」视觉块（按钮 + 两开关 + 空内容提示），作为文字与口语共享的单一数据源。

接口：

```ts
interface SimulationConfigBarProps {
  config: SimulationModeState; // 复用现有 SidePanel.tsx 的 SimulationModeState 类型
  onToggleSimulation: (enabled: boolean) => void;
  onToggleKnowledge: (enabled: boolean) => void;
  onOpenConfig: () => void;
  disabled: boolean; // 同时控制按钮与开关；处理中禁用
}
```

组件内部沿用现有实现：`hasDialogueSimulationContent = Boolean(normalizeDialogueSimulationContent(config.dialogueSimulationContent))`，`hasKnowledgeBaseContent = Boolean(config.knowledgeBaseContent.trim())`，据此渲染「未识别内容 / 未配置内容」提示。

### 4.2 改造 `ChatInput`（文字模式）

`ChatInput` 中原「模拟对话 / 知识库」块替换为 `<SimulationConfigBar … />`，`disabled` 传 `isLoading`；**保留**其自身的「调试模式」按钮（511–520）与「多角色并行」按钮（561–571）。文字模式行为与现状一致。

> 注：现有 `ChatInput` 对该块用了 `toggleDisabled`（开关）与 `debugDisabled`（按钮）两个标志，当前取值都等于 `isLoading`。共享组件将其合并为单个 `disabled`，属行为保持（两者本就同值）。

### 4.3 改造 `VoiceChatArea`（口语模式）

在底部输入区上方渲染 `<SimulationConfigBar … />`，**IDLE 与已连接两态都显示**，使用户可在建立通道前就配好、再开全自动。`disabled` 传 `voice.isLoading`（处理中禁用，语义对齐文字模式）。

### 4.4 `SidePanel` 接线

- 已有的共享状态与处理函数 `simulationConfig` / `handleToggleDialogueSimulation` / `handleToggleKnowledgeBase` / `setIsSimulationConfigOpen` 透传给 `VoiceChatArea`（与现有 voice props 风格一致）。
- `SimulationConfigModal` 的 `trainTaskId` 改为按模式取：`mode === 'voice' ? (voice.trainTaskId ?? trainTaskId) : trainTaskId`。
- 口语模式下**不传** `onOpenMultiRole`（隐藏模态内的多角色入口）。

### 4.5 数据流

```
口语视图开关 → handleToggle* → 写全局 llmConfigStorage
                                      ↓
口语 autoGenerate() → generateStudentAnswer() → buildStudentRoleSystemPrompt() 读取并注入
```

无新增网络 / WS / 逻辑分支。

### 4.6 语义对齐

开关仅影响「AI 自动生成 / 全自动」回复；用户手动输入的文字仍只经 TTS 推送、不注入模拟对话 / 知识库。与文字模式现状完全一致。

## 5. 已知风险（不阻塞本期）

`SimulationConfigModal` 内「根据剧本生成模拟对话」按钮调用 `generateSimulationDialogueRecord()`，其取步骤列表硬编码 `trainSubType: 'ability'`（`llm-service.ts:704`，端点 `abilityTrain/queryScriptStepList`）。此入口现在也会出现在口语模态中，但语音任务能否用 `'ability'` 取到步骤**未经真机验证**。

- 影响面：仅「根据剧本生成」一条路径；「粘贴历史日志」与「知识库」两条主路径不依赖它。
- 跟进：用真实口语 `trainTaskId` 验证一次；若返回空 / 错数据，则把 `trainSubType` 参数化（按 `mode` 传 'ability' / 对应 voice 子类型）。作为快速跟进项，不纳入本期实现。

## 6. 验收标准

1. 口语模式底部出现「对话模拟 / 知识库」按钮，点击打开 `SimulationConfigModal`（不含多角色入口）。
2. 口语模式出现「模拟对话」「知识库」两开关，状态与文字模式互通（同一全局配置）；空内容时显示对应提示。
3. 在口语模式启用模拟对话 / 知识库并跑「全自动」，生成的学生回答确实受配置影响（与文字模式表现一致）。
4. 文字模式工具栏外观与行为不回归（调试、多角色按钮仍在且可用）。
5. `pnpm lint` 与 `pnpm type-check` 通过。

## 7. 不改动项

口语 WS 客户端、TTS / 音频管线、调试模式（`DebugStepsModal` 及 `runDebugStep`）、多角色（`useMultiRoleRun` / `MultiRolePickerModal`）一律不碰。
