# 文本模式空闲态显示对话模拟配置实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让文本模式在尚未开始对话时显示完整的“对话模拟 / 知识库”配置栏。

**Architecture:** 保持 `SimulationConfigBar` 为文字和语音模式的共享组件，只调整 `SidePanel` 文本空闲态的组合方式。在现有 `StartButton` 外增加同级底部容器，复用当前配置状态和回调，不新增状态或运行时分支。

**Tech Stack:** TypeScript、React 19、Node.js 内置测试运行器、ESLint、TypeScript Compiler

## Global Constraints

- 遵循 DRY、SOLID、KISS，优先复用现有 `SimulationConfigBar`。
- 不修改语音模式、存储结构、LLM 注入逻辑或 `trainTaskId` 限制。
- 不覆盖或提交工作区中已有的无关改动。

---

### Task 1: 文本空闲态配置入口

**Files:**
- Create: `pages/side-panel/src/SidePanel.idle-controls.test.mjs`
- Modify: `pages/side-panel/src/SidePanel.tsx:1428-1432`

**Interfaces:**
- Consumes: `SimulationConfigBar`、`simulationConfig`、`handleToggleDialogueSimulation`、`handleToggleKnowledgeBase`、`setIsSimulationConfigOpen`、`StartButton`
- Produces: 文本模式 `isIdle` 分支中的配置栏与开始按钮组合，不新增导出接口

- [ ] **Step 1: 编写失败的结构行为测试**

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./SidePanel.tsx', import.meta.url), 'utf8');
const idleBranch = source.match(/\{isIdle \? \(([\s\S]*?)\) : isChatting/);

test('文本模式空闲态同时提供模拟配置栏和开始按钮', () => {
  assert.ok(idleBranch, '应能定位文本模式空闲态分支');
  assert.match(idleBranch[1], /<SimulationConfigBar/);
  assert.match(idleBranch[1], /<StartButton/);
  assert.ok(idleBranch[1].indexOf('<SimulationConfigBar') < idleBranch[1].indexOf('<StartButton'));
});
```

- [ ] **Step 2: 运行测试并确认按预期失败**

Run: `node --test pages/side-panel/src/SidePanel.idle-controls.test.mjs`

Expected: FAIL，提示空闲态分支不包含 `<SimulationConfigBar`。

- [ ] **Step 3: 编写最小实现**

将文本模式的 `isIdle` 分支改为一个底部容器，在开始按钮前复用配置栏：

```tsx
<div className="border-t border-slate-200 bg-white p-5">
  <div className="mb-3">
    <SimulationConfigBar
      config={simulationConfig}
      onToggleSimulation={enabled => {
        void handleToggleDialogueSimulation(enabled);
      }}
      onToggleKnowledge={enabled => {
        void handleToggleKnowledgeBase(enabled);
      }}
      onOpenConfig={() => setIsSimulationConfigOpen(true)}
      disabled={isLoading}
    />
  </div>
  <StartButton onClick={startConversation} disabled={isLoading} trainTaskId={trainTaskId} embedded />
</div>
```

为避免嵌套底部边框和重复内边距，给 `StartButton` 增加可选 `embedded?: boolean` 展示参数；默认值保持原有独立布局，空闲态传入 `embedded` 时只渲染按钮和缺少 `trainTaskId` 的提示。

- [ ] **Step 4: 运行测试并确认通过**

Run: `node --test pages/side-panel/src/SidePanel.idle-controls.test.mjs`

Expected: PASS，1 个测试通过。

- [ ] **Step 5: 运行范围化质量检查**

Run: `pnpm -F @extension/sidepanel lint`

Expected: PASS，无 ESLint 错误。

Run: `pnpm -F @extension/sidepanel type-check`

Expected: PASS，无 TypeScript 错误。

- [ ] **Step 6: 检查改动范围**

Run: `git diff --check && git diff -- pages/side-panel/src/SidePanel.tsx pages/side-panel/src/SidePanel.idle-controls.test.mjs`

Expected: 无空白错误；只包含空闲态配置栏、`StartButton` 嵌入布局支持及回归测试。
