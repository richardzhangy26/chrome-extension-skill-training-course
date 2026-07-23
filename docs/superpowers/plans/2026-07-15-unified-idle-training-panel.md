# 统一训练空闲态实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让能力训练、口语训练和能力训练 Pro 在未开始训练时复用同一套配置栏、启动按钮和提示内容。

**Architecture:** 在 `SidePanel.tsx` 内提取本地 `IdleTrainingPanel`，组合现有 `SimulationConfigBar` 与 `StartButton`。文字与 Pro 传入 `startConversation`，口语传入 `voice.startSession`；进入运行态后继续使用各自现有界面。

**Tech Stack:** TypeScript、React、Tailwind CSS、Vite、Chrome Extension MV3。

## Global Constraints

- 遵循 DRY、SOLID、KISS，并沿用现有 `SimulationConfigBar`、`StartButton` 和状态 hook。
- 不修改 `useAgentChat`、`useVoiceAgentChat`、多角色 hook、存储或后端。
- 三种模式的 Header 标题统一为“能力训练助手”，当前模式只由下拉框展示。
- 只统一空闲态；训练开始后的文字和语音界面保持不变。
- 不新增依赖。

---

### Task 1: 提取并接入共享空闲态组件

**Files:**
- Modify: `pages/side-panel/src/SidePanel.tsx`

**Interfaces:**
- Consumes: `SimulationModeState`、`SimulationConfigBar`、`StartButton`、当前模式启动回调及 `trainTaskId`。
- Produces: `IdleTrainingPanel(props): JSX.Element`，供文字、口语和 Pro 空闲态复用。

- [ ] **Step 1: 写入并运行失败的结构回归检查**

运行以下一次性检查：

```bash
node -e "const fs=require('fs'); const s=fs.readFileSync('pages/side-panel/src/SidePanel.tsx','utf8'); const uses=(s.match(/<IdleTrainingPanel/g)||[]).length; if(!/const IdleTrainingPanel\s*=/.test(s)||uses!==2||!/voice:\s*'能力训练助手'/.test(s)) throw new Error('三种模式尚未共享统一空闲态');"
```

Expected: FAIL，错误为“三种模式尚未共享统一空闲态”。

- [ ] **Step 2: 新增共享组件**

在 `StartButton` 后新增：

```tsx
interface IdleTrainingPanelProps {
  simulationConfig: SimulationModeState;
  onToggleSimulation: (enabled: boolean) => void;
  onToggleKnowledge: (enabled: boolean) => void;
  onOpenSimulationConfig: () => void;
  onStart: () => void;
  isLoading: boolean;
  trainTaskId: string | null;
}

const IdleTrainingPanel = ({
  simulationConfig,
  onToggleSimulation,
  onToggleKnowledge,
  onOpenSimulationConfig,
  onStart,
  isLoading,
  trainTaskId,
}: IdleTrainingPanelProps) => (
  <div className="border-t border-slate-200 bg-white p-5">
    <div className="mb-3">
      <SimulationConfigBar
        config={simulationConfig}
        onToggleSimulation={onToggleSimulation}
        onToggleKnowledge={onToggleKnowledge}
        onOpenConfig={onOpenSimulationConfig}
        disabled={isLoading}
      />
    </div>
    <StartButton onClick={onStart} disabled={isLoading} trainTaskId={trainTaskId} embedded />
  </div>
);
```

- [ ] **Step 3: 让口语空闲态使用共享组件**

将 `VoiceChatArea` 的 `IDLE / ERROR` 分支替换为：

```tsx
<IdleTrainingPanel
  simulationConfig={simulationConfig}
  onToggleSimulation={onToggleSimulation}
  onToggleKnowledge={onToggleKnowledge}
  onOpenSimulationConfig={onOpenSimulationConfig}
  onStart={onStart}
  isLoading={voice.isLoading || !canStart}
  trainTaskId={trainTaskId}
/>
```

删除口语分支中独立维护的“建立语音通道”按钮样式和文案。

- [ ] **Step 4: 让文字与 Pro 空闲态使用共享组件**

将文字分支的 `isIdle` 内容替换为：

```tsx
<IdleTrainingPanel
  simulationConfig={simulationConfig}
  onToggleSimulation={enabled => {
    void handleToggleDialogueSimulation(enabled);
  }}
  onToggleKnowledge={enabled => {
    void handleToggleKnowledgeBase(enabled);
  }}
  onOpenSimulationConfig={() => setIsSimulationConfigOpen(true)}
  onStart={startConversation}
  isLoading={isLoading}
  trainTaskId={trainTaskId}
/>
```

由于 Pro 继续进入非语音分支，它自动复用同一组件。

- [ ] **Step 5: 统一 Header 标题**

将标题映射改为：

```tsx
const TRAINING_MODE_TITLES: Record<TrainingMode, string> = {
  text: '能力训练助手',
  voice: '能力训练助手',
  pro: '能力训练助手',
};
```

- [ ] **Step 6: 运行回归检查和静态验证**

重新运行 Step 1 的一次性检查。

Expected: PASS。

Run: `pnpm -F @extension/sidepanel lint`

Expected: PASS。

Run: `pnpm -F @extension/sidepanel type-check`

Expected: PASS。

- [ ] **Step 7: 运行生产构建和差异检查**

Run: `CLI_CEB_DEV=false pnpm -F @extension/sidepanel build`

Expected: PASS，Vite 生产构建正常退出。

Run: `git diff --check`

Expected: PASS。

- [ ] **Step 8: 提交实现**

```bash
git add pages/side-panel/src/SidePanel.tsx
git commit -m "refactor(side-panel): unify idle training panels"
```
