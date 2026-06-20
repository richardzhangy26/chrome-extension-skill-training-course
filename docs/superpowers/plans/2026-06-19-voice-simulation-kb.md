# 口语模式「模拟对话 / 知识库」实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把「模拟对话 / 知识库」的配置入口与启用开关暴露到口语训练模式，让口语用户无需切回文字模式即可配置并启用这两项能力。

**Architecture:** 这两项的运行逻辑在口语模式已生效（`useVoiceAgentChat.autoGenerate()` → `generateStudentAnswer()` → `buildStudentRoleSystemPrompt()` 已从全局 `llmConfigStorage` 注入配置）。本次只做 UI 暴露：把文字模式工具栏里的「模拟/知识库」视觉块抽成共享组件 `SimulationConfigBar`，文字与口语两侧共用；并让 `SimulationConfigModal` 在口语模式取正确的 `trainTaskId`、隐藏多角色入口。无新增网络 / WS / 业务逻辑。

**Tech Stack:** TypeScript + React（ESM）、Tailwind、`@extension/storage`（Chrome storage 封装）、Vite 构建、ESLint（严格）。

## Global Constraints

- 仅改动 `pages/side-panel/src/`；不碰 WS / TTS（`services/ws/`、`services/audio/`）、调试模式（`DebugStepsModal`、`runDebugStep`）、多角色（`useMultiRoleRun`、`MultiRolePickerModal`）。
- ESLint（严格，pre-commit 会拦截）：① 组件用箭头函数表达式，不用函数声明；② 所有 `export` 置于文件**末尾**；③ jsx-a11y——`<label>` 须包裹/关联表单控件，可点击非交互元素需键盘支持；④ `@typescript-eslint/no-unused-vars`——移除任何变为未使用的变量/导入。
- 跨 workspace 用 `@extension/*` 命名空间；workspace 内部用相对路径（沿用现有写法，如 `./services/...`）。
- 缩进 2 空格，保留分号与尾逗号；组件 PascalCase。
- **不直接编辑 `manifest.json`**（本计划不涉及，仅作约束提醒）。
- **验证周期：`pnpm type-check` + `pnpm lint`（可选叠加 `pnpm -F side-panel type-check` / `... lint` 加速）+ 手动加载扩展核对。** 本仓库无单元测试框架（仅有重型 `pnpm e2e`，需真实 Polymas 会话 + 鉴权 cookie + trainTaskId），为一个纯展示型组件抽取引入单测框架属过度工程化，不做。每个任务以「type-check + lint 通过 + 手动核对验收点」作为可独立验证的交付。

---

## File Structure

- **Create** `pages/side-panel/src/components/SimulationConfigBar.tsx` — 文字/口语共享的「模拟对话 / 知识库」配置栏（入口按钮 + 两个启用开关 + 空内容提示）。拥有并导出配置类型 `SimulationModeState`。
- **Modify** `pages/side-panel/src/SidePanel.tsx` — ① 改 import（引入新组件与类型，移除变为未使用的 `normalizeDialogueSimulationContent`、`LLMConfig`、本地 `SimulationModeState` 定义）；② `ChatInput`（文字模式）内联块替换为 `<SimulationConfigBar>`；③ `VoiceChatArea`（口语模式）渲染 `<SimulationConfigBar>`；④ 主渲染把 props 透传给 `VoiceChatArea`，并让 `SimulationConfigModal` 的 `trainTaskId` 按模式取、口语模式不传 `onOpenMultiRole`。

> 行号以当前 `main` 上的 `SidePanel.tsx` 为准，编辑后会偏移；每处编辑都给了唯一锚点文本，按文本定位而非行号。

---

## Task 1: 抽取共享组件 `SimulationConfigBar`，文字模式无回归接入

**Files:**
- Create: `pages/side-panel/src/components/SimulationConfigBar.tsx`
- Modify: `pages/side-panel/src/SidePanel.tsx`（imports；`ChatInput` 内联块 522–559、局部常量 473–476；本地类型 185–188）

**Interfaces:**
- Produces:
  - `SimulationConfigBar` 组件，props：`{ config: SimulationModeState; onToggleSimulation: (enabled: boolean) => void; onToggleKnowledge: (enabled: boolean) => void; onOpenConfig: () => void; disabled: boolean }`
  - `type SimulationModeState = Pick<LLMConfig, 'dialogueSimulationEnabled' | 'dialogueSimulationContent' | 'knowledgeBaseEnabled' | 'knowledgeBaseContent'>`（从本组件导出，供 SidePanel 复用）
- Consumes: `normalizeDialogueSimulationContent`（`../services/llm-service`）、`LLMConfig`（`@extension/storage`）

- [ ] **Step 1: 新建共享组件文件**

创建 `pages/side-panel/src/components/SimulationConfigBar.tsx`，内容完整如下（Book 图标内联，避免依赖 SidePanel 内部的局部 `Icons`）：

```tsx
/**
 * 模拟对话 / 知识库 配置栏（文字与口语模式共享）
 * 仅负责展示入口按钮与两个启用开关；配置内容由 SimulationConfigModal 编辑，
 * 开关状态由上层写入全局 llmConfigStorage。
 */

import { normalizeDialogueSimulationContent } from '../services/llm-service';
import type { LLMConfig } from '@extension/storage';

type SimulationModeState = Pick<
  LLMConfig,
  'dialogueSimulationEnabled' | 'dialogueSimulationContent' | 'knowledgeBaseEnabled' | 'knowledgeBaseContent'
>;

interface SimulationConfigBarProps {
  config: SimulationModeState;
  onToggleSimulation: (enabled: boolean) => void;
  onToggleKnowledge: (enabled: boolean) => void;
  onOpenConfig: () => void;
  disabled: boolean;
}

const BookIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

const SimulationConfigBar = ({
  config,
  onToggleSimulation,
  onToggleKnowledge,
  onOpenConfig,
  disabled,
}: SimulationConfigBarProps) => {
  const hasDialogueSimulationContent = Boolean(normalizeDialogueSimulationContent(config.dialogueSimulationContent));
  const hasKnowledgeBaseContent = Boolean(config.knowledgeBaseContent.trim());

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={onOpenConfig}
        disabled={disabled}
        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 transition-all duration-200 hover:border-sky-300 hover:text-sky-600 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
        title="配置对话模拟与知识库模式">
        <BookIcon />
        <span>对话模拟 / 知识库</span>
      </button>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
        <label className="flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={config.dialogueSimulationEnabled}
            disabled={disabled}
            onChange={event => onToggleSimulation(event.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 disabled:cursor-not-allowed"
          />
          <span>模拟对话</span>
          {config.dialogueSimulationEnabled && !hasDialogueSimulationContent && (
            <span className="text-amber-600">未识别内容</span>
          )}
        </label>
        <label className="flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={config.knowledgeBaseEnabled}
            disabled={disabled}
            onChange={event => onToggleKnowledge(event.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 disabled:cursor-not-allowed"
          />
          <span>知识库</span>
          {config.knowledgeBaseEnabled && !hasKnowledgeBaseContent && (
            <span className="text-amber-600">未配置内容</span>
          )}
        </label>
      </div>
    </div>
  );
};

export { SimulationConfigBar };
export type { SimulationModeState };
```

- [ ] **Step 2: SidePanel 改 import——引入新组件与类型**

在 `SidePanel.tsx` 的 `SimulationConfigModal` import 之后新增两行（保持 import 分组顺序）：

```tsx
import { SimulationConfigModal } from './components/SimulationConfigModal';
import { SimulationConfigBar } from './components/SimulationConfigBar';
```

并在文件类型 import 区新增（与其它 `import type` 放在一起）：

```tsx
import type { SimulationModeState } from './components/SimulationConfigBar';
```

- [ ] **Step 3: SidePanel 移除本地 `SimulationModeState` 定义**

删除下面这段本地定义（现位于 185–188 行），因为类型已改为从 `SimulationConfigBar` 导入：

```tsx
type SimulationModeState = Pick<
  LLMConfig,
  'dialogueSimulationEnabled' | 'dialogueSimulationContent' | 'knowledgeBaseEnabled' | 'knowledgeBaseContent'
>;
```

- [ ] **Step 4: `ChatInput` 内联块替换为 `<SimulationConfigBar>`**

4a. 删除 `ChatInput` 顶部的两个局部常量（现位于 473–476 行）：

```tsx
  const hasDialogueSimulationContent = Boolean(
    normalizeDialogueSimulationContent(simulationConfig.dialogueSimulationContent),
  );
  const hasKnowledgeBaseContent = Boolean(simulationConfig.knowledgeBaseContent.trim());
```

4b. 把「对话模拟 / 知识库」整块（现位于 522–559 行，锚点：`title="配置对话模拟与知识库模式"` 所在的外层 `<div className="flex flex-col items-start gap-1">` ... 到其闭合 `</div>`）整体替换为：

```tsx
        <SimulationConfigBar
          config={simulationConfig}
          onToggleSimulation={onToggleDialogueSimulation}
          onToggleKnowledge={onToggleKnowledgeBase}
          onOpenConfig={onOpenSimulationConfig}
          disabled={toggleDisabled}
        />
```

> 注意：原块按钮用 `debugDisabled`、开关用 `toggleDisabled`，调用点两者均为 `isLoading`（见主渲染 `toggleDisabled={isLoading}`、`debugDisabled={isLoading}`），合并为单个 `disabled={toggleDisabled}` 属行为保持。`ChatInput` 自身的「调试模式」「多角色并行」按钮**保持不动**。

- [ ] **Step 5: 移除变为未使用的 import**

经 grep 确认，`normalizeDialogueSimulationContent` 仅在被删的 4a 处使用、`LLMConfig` 仅在被删的本地 `SimulationModeState` 处使用，二者现已无引用，删除这两行 import：

```tsx
import { normalizeDialogueSimulationContent } from './services/llm-service';
```
```tsx
import type { LLMConfig } from '@extension/storage';
```

> 保留第 13 行 `import { llmConfigStorage } from '@extension/storage';`（仍在使用）。

- [ ] **Step 6: 类型检查（验证编译正确 + 无未使用符号）**

Run: `pnpm -F side-panel type-check`（或根级 `pnpm type-check`）
Expected: 退出码 0，无报错。若报 `SimulationModeState`/`LLMConfig`/`normalizeDialogueSimulationContent` 相关错误，回到 Step 2–5 核对增删是否成对。

- [ ] **Step 7: Lint（验证 ESLint 严格规则）**

Run: `pnpm -F side-panel lint`（或根级 `pnpm lint`）
Expected: 退出码 0，无 error。特别确认无 `no-unused-vars`（残留未使用 import）、`import-x/exports-last`（新组件 export 已在末尾）。

- [ ] **Step 8: 手动核对文字模式无回归**

`pnpm dev` 后在 `chrome://extensions` 重新加载 `dist/`，进入含 `trainTaskId` 的训练页、文字模式、开始对话：
- 工具栏「对话模拟 / 知识库」按钮、「模拟对话」「知识库」两开关外观与改造前一致；
- 「调试模式」「多角色并行」按钮仍在且可点击；
- 勾选「模拟对话」但内容为空时显示「未识别内容」，知识库为空显示「未配置内容」。

- [ ] **Step 9: 提交**

```bash
git add pages/side-panel/src/components/SimulationConfigBar.tsx pages/side-panel/src/SidePanel.tsx
git commit -m "refactor(side-panel): 抽取共享 SimulationConfigBar 组件"
```

---

## Task 2: 口语模式接入配置栏 + 模态按模式适配

**Files:**
- Modify: `pages/side-panel/src/SidePanel.tsx`（`VoiceChatAreaProps` 与 `VoiceChatArea` 渲染；主渲染 `<VoiceChatArea>` 透传；`<SimulationConfigModal>` 接线）

**Interfaces:**
- Consumes（来自 Task 1）：`SimulationConfigBar`、`SimulationModeState`；以及主组件已有的共享状态/处理函数 `simulationConfig`、`handleToggleDialogueSimulation`、`handleToggleKnowledgeBase`、`setIsSimulationConfigOpen`、`mode`、`voice`、`trainTaskId`。
- Produces：口语视图新增 4 个 props：`simulationConfig: SimulationModeState`、`onToggleSimulation: (enabled: boolean) => void`、`onToggleKnowledge: (enabled: boolean) => void`、`onOpenSimulationConfig: () => void`。

- [ ] **Step 1: 扩展 `VoiceChatAreaProps` 接口并解构**

1a. 在 `VoiceChatAreaProps`（锚点：`interface VoiceChatAreaProps {`）的 `trainTaskId: string | null;` 之后新增四行：

```tsx
  trainTaskId: string | null;
  simulationConfig: SimulationModeState;
  onToggleSimulation: (enabled: boolean) => void;
  onToggleKnowledge: (enabled: boolean) => void;
  onOpenSimulationConfig: () => void;
```

1b. 在 `const VoiceChatArea = ({ ... }` 解构（锚点：`  trainTaskId,` 在解构列表中）的 `trainTaskId,` 之后新增四行：

```tsx
  trainTaskId,
  simulationConfig,
  onToggleSimulation,
  onToggleKnowledge,
  onOpenSimulationConfig,
```

- [ ] **Step 2: 在口语视图两态渲染 `<SimulationConfigBar>`**

2a. IDLE/ERROR 分支（锚点：`{trainTaskId ? '🎙️ 建立语音通道' : ...}` 所在的 `<button>` 外层 `<div className="border-t border-slate-200 bg-white p-5">`）——在该 `<button>` 之前插入配置栏：

```tsx
        <div className="border-t border-slate-200 bg-white p-5">
          <div className="mb-3">
            <SimulationConfigBar
              config={simulationConfig}
              onToggleSimulation={onToggleSimulation}
              onToggleKnowledge={onToggleKnowledge}
              onOpenConfig={onOpenSimulationConfig}
              disabled={voice.isLoading}
            />
          </div>
          <button
            type="button"
            onClick={onStart}
```

2b. 已连接分支（锚点：`<div className="border-t border-slate-200 bg-white">` 紧跟着 `<div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2 ...">` 状态行）——在状态行之前插入配置栏：

```tsx
        <div className="border-t border-slate-200 bg-white">
          <div className="px-4 pt-3">
            <SimulationConfigBar
              config={simulationConfig}
              onToggleSimulation={onToggleSimulation}
              onToggleKnowledge={onToggleKnowledge}
              onOpenConfig={onOpenSimulationConfig}
              disabled={voice.isLoading}
            />
          </div>
          <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
```

- [ ] **Step 3: 主渲染——把新 props 透传给 `<VoiceChatArea>`**

在主组件返回的 `<VoiceChatArea ... />`（锚点：`onAutoRunToggle={handleVoiceAutoRunToggle}`）的 `trainTaskId={voice.trainTaskId ?? trainTaskId}` 之后新增四个属性：

```tsx
          onAutoRunToggle={handleVoiceAutoRunToggle}
          trainTaskId={voice.trainTaskId ?? trainTaskId}
          simulationConfig={simulationConfig}
          onToggleSimulation={enabled => {
            void handleToggleDialogueSimulation(enabled);
          }}
          onToggleKnowledge={enabled => {
            void handleToggleKnowledgeBase(enabled);
          }}
          onOpenSimulationConfig={() => setIsSimulationConfigOpen(true)}
        />
```

- [ ] **Step 4: `SimulationConfigModal` 按模式取 `trainTaskId` 并在口语模式隐藏多角色入口**

把根部的 `<SimulationConfigModal ... />`（锚点：`isOpen={isSimulationConfigOpen}`）整体替换为：

```tsx
      <SimulationConfigModal
        isOpen={isSimulationConfigOpen}
        onClose={() => setIsSimulationConfigOpen(false)}
        trainTaskId={mode === 'voice' ? (voice.trainTaskId ?? trainTaskId) : trainTaskId}
        onOpenMultiRole={
          mode === 'voice'
            ? undefined
            : () => {
                setIsSimulationConfigOpen(false);
                setIsMultiRolePickerOpen(true);
              }
        }
      />
```

> `SimulationConfigModal` 内部多角色区块以 `{onOpenMultiRole && (...)}` 渲染（见 `SimulationConfigModal.tsx:333`），传 `undefined` 即隐藏。

- [ ] **Step 5: 类型检查**

Run: `pnpm -F side-panel type-check`（或 `pnpm type-check`）
Expected: 退出码 0。若报 `VoiceChatArea` 缺 props，核对 Step 3 是否四个属性都传齐。

- [ ] **Step 6: Lint**

Run: `pnpm -F side-panel lint`（或 `pnpm lint`）
Expected: 退出码 0，无 error。

- [ ] **Step 7: 手动核对口语模式验收点**

`pnpm dev` 重新加载扩展，切到口语模式：
- IDLE（未连接）态：连接按钮上方出现「对话模拟 / 知识库」按钮 + 两开关；已连接态：状态行上方同样出现配置栏。
- 点「对话模拟 / 知识库」打开模态，**模态内不出现「多角色并行运行」区块**；模态显示当前口语任务（`trainTaskId` 正确）。
- 在文字模式勾上「模拟对话」，切到口语模式开关同为勾选（同一全局配置互通）；反向亦然。
- **关键验证（证明整个迁移命题）：** 口语模式启用「模拟对话」，粘贴一段含**特征哨兵句**的 `AI:/用户:` 示例——例如刻意让「用户:」回答里固定出现「菠萝蜜暗号」这类无意义短语——再跑「全自动」。若生成的学生回答里出现该哨兵句，即**二值化**证明 sim/KB 确实经 `autoGenerate → generateStudentAnswer → buildStudentRoleSystemPrompt` 注入到口语链路（避免「受影响」这种主观判断）。手动输入文字**不应**带哨兵句（仅走 TTS、不注入）。
- **已知预期项（不算失败）：** 模态里的「根据剧本生成模拟对话」按钮在口语任务下可能因硬编码 `trainSubType:'ability'` 取不到步骤而报错/空结果——这是 spec §5 的跟进项，**非本期 bug**；核对时若遇到，记录但不视为回归。「粘贴历史日志」与「知识库」两条主路径不受其影响。

- [ ] **Step 8: 提交**

```bash
git add pages/side-panel/src/SidePanel.tsx
git commit -m "feat(side-panel): 口语模式接入模拟对话/知识库配置入口"
```

---

## 跟进项（不在本计划范围，来自 spec §5）

`SimulationConfigModal` 内「根据剧本生成模拟对话」按钮 → `generateSimulationDialogueRecord()` 取步骤列表时硬编码 `trainSubType: 'ability'`（`llm-service.ts:704`）。该入口现在也出现在口语模态中，但语音任务能否用 `'ability'` 取到步骤未经真机验证。需用真实口语 `trainTaskId` 验证一次；若取不到则把 `trainSubType` 参数化。spec 已将其列为本期范围外的快速跟进项。

---

## Self-Review

**1. Spec coverage（对照 spec 各节）：**
- §3 纳入「模拟对话 / 知识库 配置入口 + 两开关」→ Task 1（抽组件）+ Task 2（口语接入）✅
- §4.1 新增 `SimulationConfigBar` → Task 1 Step 1 ✅
- §4.2 文字 `ChatInput` 内嵌、保留调试/多角色、`disabled` 传 `isLoading`(=toggleDisabled) → Task 1 Step 4 ✅
- §4.3 口语两态渲染、`disabled=voice.isLoading` → Task 2 Step 2 ✅
- §4.4 主渲染透传 + 模态 `trainTaskId` 按模式取 + 口语不传 `onOpenMultiRole` → Task 2 Step 3、4 ✅
- §4.6 语义对齐（仅影响自动回复）→ 复用既有 `autoGenerate` 链路，无改动，Task 2 Step 7 手动核对 ✅
- §5 风险 → 「跟进项」明确列出、范围外 ✅
- §6 验收标准 1–5 → Task 1 Step 8 / Task 2 Step 7（行为）+ 两任务的 type-check/lint（标准 5）✅
- §7 不改动项 → Global Constraints 首条约束 ✅

**2. Placeholder scan：** 无 TBD/TODO；每个改动步骤均给出完整代码或精确增删文本与锚点。✅

**3. Type consistency：** 组件 props 名（`config`/`onToggleSimulation`/`onToggleKnowledge`/`onOpenConfig`/`disabled`）在 Task 1 定义、Task 2 两处调用一致；`SimulationModeState` 由 `SimulationConfigBar` 导出、SidePanel 与 `VoiceChatAreaProps` 一致引用；`handleToggleDialogueSimulation`/`handleToggleKnowledgeBase` 为主组件既有函数（`SidePanel.tsx:1181/1189`），通过箭头包装适配 `onToggleSimulation`/`onToggleKnowledge` 的 `(enabled)=>void` 签名。✅
