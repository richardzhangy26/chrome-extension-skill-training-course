# 多角色 P1：每角色独立知识库 / 对话剧本配置 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 P0「多人共享全局知识库/对话剧本」基础上，让多角色运行中的每个角色可以独立配置自己的对话剧本与知识库内容，且 UI 上支持在角色选择/运行视图里实时调整；同时为「根据剧本生成模拟对话」新增**自定义提示词模式**（保留好/一般/差学生三档预设不变），支持如「好学生走 A 路径」的路由类生成需求。

**Architecture:** 扩展 `RuntimeProfileOverride` 使其同时携带 `profile` 与 `runtimeConfigOverride`；`generateStudentAnswer` 在构造 system prompt 时优先使用 override 配置；`RoleRunState` 增加 `runtimeConfigOverride` 字段并在 `useMultiRoleRun` 的自动回复链路中透传；UI 在 `MultiRolePickerModal` 与侧栏多角色折叠卡片中暴露按角色编辑入口，但**不改动 `llmConfigStorage` schema**（P1 配置仅保存在运行期内存态）。对话剧本生成侧（Task 7-9，独立于 Task 1-6）：`GeneratorProfile` 增加 `custom` 档并接收 `customInstruction`；因为 `resolveOrderedScriptStages` 只沿 `isDefault === 1` 的默认 flow 线性化阶段，纯注入提示词无法覆盖分支阶段，所以自定义模式在 flow 存在分支时先用一次 LLM 调用在流程图上规划阶段路径（严格 JSON 输出 + 节点/连通性校验，失败回退默认路径），再沿该路径逐阶段生成。

**Tech Stack:** TypeScript, React, Tailwind CSS, Chrome Extension MV3, `@extension/storage`, `@extension/sidepanel` workspace.

## Global Constraints

- 仅修改 `pages/side-panel/` 下的文件与 `packages/storage` 的导出类型，不修改 Admin Web。
- `llm-config-storage.ts` 的 schema 不变；P1 的 per-role 配置**不持久化**，仅保存在 `RoleRunState` 内存态。
- 单角色主链路（`useAgentChat`）行为必须零变化。
- 角色间失败互不阻塞；手动输入仅发给当前选中角色（P0 约束继续生效）。
- 代码风格：2 空格缩进、箭头函数、文件末尾统一 export（见仓库 ESLint `func-style` / `exports-last`）。
- 所有新组件/Hook 必须提供 TypeScript 类型，并通过 `pnpm -F @extension/sidepanel lint` 与 `pnpm -F @extension/sidepanel type-check`。
- 好/一般/差学生三档预设的生成提示词文案与行为**保持不变**；自定义模式是独立分支，不复用、不修改预设 guidance。
- 逐阶段生成机制不变，禁止回退为一次性生成（历史上会静默截断）。
- 自定义模式的路径规划失败时必须**静默回退默认路径**继续生成，不能让整次生成失败。
- 自定义生成仅在全局 `SimulationConfigModal` 提供；per-role 编辑器（Task 3）保持纯文本粘贴，生成结果可手动复制过去。

---

## File Structure

| 文件 | 变更 | 职责 |
|---|---|---|
| `pages/side-panel/src/types/multi-role-types.ts` | 修改 | 增加 `RoleRuntimeConfig`、`RoleRunState.runtimeConfigOverride` |
| `pages/side-panel/src/services/llm-service.ts` | 修改 | 扩展 `RuntimeProfileOverride`；`buildStudentRoleSystemPrompt` 支持可选配置覆盖；新增自定义生成模式（`custom` 档 + `customInstruction`）与流程图路径规划 |
| `pages/side-panel/src/hooks/useMultiRoleRun.ts` | 修改 | 在创建角色与自动回复链路中透传 `runtimeConfigOverride` |
| `pages/side-panel/src/components/MultiRolePickerModal.tsx` | 修改 | 每角色可展开编辑独立对话剧本/知识库 |
| `pages/side-panel/src/components/RoleRuntimeConfigEditor.tsx` | 新建 | 复用的 per-role 配置编辑子组件 |
| `pages/side-panel/src/SidePanel.tsx` | 修改 | 多角色折叠卡片加「编辑角色配置」入口 |
| `pages/side-panel/src/components/SimulationConfigModal.tsx` | 修改 | 生成器新增「自定义」档位卡片与提示词输入框 |
| `pages/side-panel/src/__tests__/llm-service-runtime-override.test.ts` | 新建 | 验证 override 优先于全局配置 |
| `pages/side-panel/src/__tests__/llm-service-custom-generation.test.ts` | 新建 | 验证自定义模式提示词注入与路径规划辅助函数 |

---

### Task 1: 扩展类型与 LLM 服务 override 能力

**Files:**
- Modify: `pages/side-panel/src/types/multi-role-types.ts`
- Modify: `pages/side-panel/src/services/llm-service.ts`
- Test: `pages/side-panel/src/__tests__/llm-service-runtime-override.test.ts`

**Interfaces:**
- Consumes: `LLMConfig` 的 `dialogueSimulationEnabled / dialogueSimulationContent / knowledgeBaseEnabled / knowledgeBaseContent` 字段（来自 `@extension/storage`）。
- Produces: `RoleRuntimeConfig` 类型；`RuntimeProfileOverride` 扩展为 `{ profile: StudentProfile; runtimeConfigOverride?: RoleRuntimeConfig }`；`buildStudentRoleSystemPrompt(systemPrompt, profile, config, runtimeConfigOverride?)`。

- [ ] **Step 1: 在 `multi-role-types.ts` 增加运行时配置类型**

```typescript
interface RoleRuntimeConfig {
  dialogueSimulationEnabled: boolean;
  dialogueSimulationContent: string;
  knowledgeBaseEnabled: boolean;
  knowledgeBaseContent: string;
}
```

并在 `RoleRunState` 中新增字段：

```typescript
interface RoleRunState {
  // ...existing fields
  runtimeConfigOverride: RoleRuntimeConfig | null;
}
```

- [ ] **Step 2: 导出 `RoleRuntimeConfig` 类型**

```typescript
export type { MultiRoleRunBatch, RoleRunDraft, RoleRunState, RoleRuntimeConfig };
```

- [ ] **Step 3: 修改 `llm-service.ts` 中的 `RuntimeProfileOverride`**

```typescript
interface RuntimeProfileOverride {
  profile: StudentProfile;
  runtimeConfigOverride?: RoleRuntimeConfig;
}
```

- [ ] **Step 4: 修改 `buildStudentRoleSystemPrompt` 签名并应用 override**

```typescript
const buildStudentRoleSystemPrompt = (
  systemPrompt: string,
  profile: { label: string; description: string; style: string; fallbackHint?: string },
  config: Pick<
    LLMConfig,
    'dialogueSimulationEnabled' | 'dialogueSimulationContent' | 'knowledgeBaseEnabled' | 'knowledgeBaseContent'
  >,
  runtimeConfigOverride?: RoleRuntimeConfig,
) => {
  const effectiveDialogueEnabled = runtimeConfigOverride?.dialogueSimulationEnabled ?? config.dialogueSimulationEnabled;
  const effectiveDialogueContent = runtimeConfigOverride?.dialogueSimulationContent ?? config.dialogueSimulationContent;
  const effectiveKnowledgeEnabled = runtimeConfigOverride?.knowledgeBaseEnabled ?? config.knowledgeBaseEnabled;
  const effectiveKnowledgeContent = runtimeConfigOverride?.knowledgeBaseContent ?? config.knowledgeBaseContent;

  const dialogueSimulationContent = effectiveDialogueEnabled
    ? normalizeDialogueSimulationContent(effectiveDialogueContent)
    : '';
  // ... rest unchanged, but use effectiveKnowledgeEnabled / effectiveKnowledgeContent below
};
```

- [ ] **Step 5: 在 `generateStudentAnswer` 中把 override 传入 `buildStudentRoleSystemPrompt`**

```typescript
const profile = runtimeOverride?.profile ?? resolveStudentProfile(config);
const roleSystemPrompt = buildStudentRoleSystemPrompt(
  systemPrompt,
  profile,
  config,
  runtimeOverride?.runtimeConfigOverride,
);
```

- [ ] **Step 6: 编写失败测试验证 override 优先**

```typescript
import { describe, it, expect } from 'vitest';

describe('buildStudentRoleSystemPrompt override', () => {
  it('should prefer runtime override dialogue content over global config', () => {
    // 因为 buildStudentRoleSystemPrompt 未导出，此测试需通过导出它或新增测试入口实现
    expect(true).toBe(true);
  });
});
```

> 注意：`buildStudentRoleSystemPrompt` 当前未导出。若项目无 vitest 配置，本任务先将其导出（但不改变行为），并补充一条最小测试；否则改为纯类型级回归，后续 Task 6 统一处理。

- [ ] **Step 7: 运行 sidepanel 类型检查**

Run: `pnpm -F @extension/sidepanel type-check`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add pages/side-panel/src/types/multi-role-types.ts pages/side-panel/src/services/llm-service.ts
pnpm -F @extension/sidepanel type-check
if [ $? -eq 0 ]; then git commit -m "feat(multi-role): extend RuntimeProfileOverride with per-role config"; fi
```

---

### Task 2: 在 `useMultiRoleRun` 中透传 per-role 配置

**Files:**
- Modify: `pages/side-panel/src/hooks/useMultiRoleRun.ts`

**Interfaces:**
- Consumes: `RoleRunState.runtimeConfigOverride`（Task 1 产出）。
- Produces: `createBatch` 支持传入初始 `runtimeConfigOverride`；`autoGenerateForRole` 调用 `generateStudentAnswer` 时附带 `runtimeConfigOverride`。

- [ ] **Step 1: 更新 `createRoleRunState` 接收可选 override**

```typescript
const createRoleRunState = (
  draft: RoleRunDraft,
  profile: StudentProfile,
  runtimeConfigOverride: RoleRuntimeConfig | null = null,
): RoleRunState => ({
  // ...existing fields
  runtimeConfigOverride,
});
```

- [ ] **Step 2: 在 `createBatch` / `startBatch` 公共 API 中接收 override map**

```typescript
const startBatch = useCallback(
  async (
    drafts: RoleRunDraft[],
    initialOverrides?: Record<string, RoleRuntimeConfig | null>,
  ): Promise<boolean> => {
    // ...
    const roles = drafts.map(draft => {
      const profile = profiles.find(p => p.id === draft.profileId) ?? profiles[0] ?? DEFAULT_STUDENT_PROFILES[0];
      return createRoleRunState(draft, profile, initialOverrides?.[draft.profileId] ?? null);
    });
    // ...
  },
  [/* existing deps */],
);
```

- [ ] **Step 3: 更新 `autoGenerateForRole` 调用 `generateStudentAnswer` 时传递 override**

```typescript
const llmResult = await generateStudentAnswer(lastAssistant.content, conversationHistory, {
  profile: role.profile,
  runtimeConfigOverride: role.runtimeConfigOverride ?? undefined,
});
```

- [ ] **Step 4: 新增 `updateRoleRuntimeConfig` action**

```typescript
const updateRoleRuntimeConfig = useCallback(
  (roleIndex: number, override: RoleRuntimeConfig | null) => {
    updateRole(roleIndex, role => ({ ...role, runtimeConfigOverride: override }));
  },
  [updateRole],
);
```

- [ ] **Step 5: 在 return 对象中暴露 `updateRoleRuntimeConfig`**

```typescript
return {
  // ...existing
  updateRoleRuntimeConfig,
};
```

- [ ] **Step 6: 运行类型检查与 lint**

Run: `pnpm -F @extension/sidepanel type-check && pnpm -F @extension/sidepanel lint`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add pages/side-panel/src/hooks/useMultiRoleRun.ts
pnpm -F @extension/sidepanel type-check && pnpm -F @extension/sidepanel lint
if [ $? -eq 0 ]; then git commit -m "feat(multi-role): propagate per-role runtime config in useMultiRoleRun"; fi
```

---

### Task 3: 新增复用的 `RoleRuntimeConfigEditor` 组件

**Files:**
- Create: `pages/side-panel/src/components/RoleRuntimeConfigEditor.tsx`

**Interfaces:**
- Consumes: `RoleRuntimeConfig` 对象与 `onChange(override: RoleRuntimeConfig)` 回调。
- Produces: 一个受控表单，支持启用/禁用对话剧本与知识库，并编辑对应文本。

- [ ] **Step 1: 创建组件文件**

```typescript
/**
 * 多角色 P1：单角色运行时配置编辑器
 */

import { useEffect, useState } from 'react';
import type { RoleRuntimeConfig } from '../types/multi-role-types';

interface RoleRuntimeConfigEditorProps {
  value: RoleRuntimeConfig | null;
  onChange: (value: RoleRuntimeConfig | null) => void;
  readOnly?: boolean;
}

const EMPTY_CONFIG: RoleRuntimeConfig = {
  dialogueSimulationEnabled: false,
  dialogueSimulationContent: '',
  knowledgeBaseEnabled: false,
  knowledgeBaseContent: '',
};

const RoleRuntimeConfigEditor = ({ value, onChange, readOnly = false }: RoleRuntimeConfigEditorProps) => {
  const [draft, setDraft] = useState<RoleRuntimeConfig>(value ?? EMPTY_CONFIG);

  useEffect(() => {
    setDraft(value ?? EMPTY_CONFIG);
  }, [value]);

  const update = (patch: Partial<RoleRuntimeConfig>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    onChange(next);
  };

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={draft.dialogueSimulationEnabled}
          disabled={readOnly}
          onChange={event => update({ dialogueSimulationEnabled: event.target.checked })}
        />
        <span className="font-medium text-slate-700">使用独立对话剧本</span>
      </label>
      {draft.dialogueSimulationEnabled && (
        <textarea
          value={draft.dialogueSimulationContent}
          disabled={readOnly}
          onChange={event => update({ dialogueSimulationContent: event.target.value })}
          placeholder="按 AI: / 用户: 格式粘贴该角色的专属历史对话"
          rows={4}
          className="w-full resize-y rounded-md border border-slate-200 bg-white px-2 py-1.5 text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100"
        />
      )}

      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={draft.knowledgeBaseEnabled}
          disabled={readOnly}
          onChange={event => update({ knowledgeBaseEnabled: event.target.checked })}
        />
        <span className="font-medium text-slate-700">使用独立知识库</span>
      </label>
      {draft.knowledgeBaseEnabled && (
        <textarea
          value={draft.knowledgeBaseContent}
          disabled={readOnly}
          onChange={event => update({ knowledgeBaseContent: event.target.value })}
          placeholder="该角色的专属参考知识"
          rows={4}
          className="w-full resize-y rounded-md border border-slate-200 bg-white px-2 py-1.5 text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100"
        />
      )}
    </div>
  );
};

export { RoleRuntimeConfigEditor };
```

- [ ] **Step 2: 运行 lint 与 type-check**

Run: `pnpm -F @extension/sidepanel lint && pnpm -F @extension/sidepanel type-check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add pages/side-panel/src/components/RoleRuntimeConfigEditor.tsx
pnpm -F @extension/sidepanel lint && pnpm -F @extension/sidepanel type-check
if [ $? -eq 0 ]; then git commit -m "feat(multi-role): add RoleRuntimeConfigEditor component"; fi
```

---

### Task 4: 在 `MultiRolePickerModal` 中支持 per-role 配置

**Files:**
- Modify: `pages/side-panel/src/components/MultiRolePickerModal.tsx`

**Interfaces:**
- Consumes: `RoleRuntimeConfigEditor`（Task 3）；`llmConfigStorage` 全局配置作为默认值来源。
- Produces: Modal 关闭时通过 `onConfirm(drafts, overrides)` 把 per-role override map 回传。

- [ ] **Step 1: 更新 props 类型**

```typescript
interface MultiRolePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (drafts: RoleRunDraft[], overrides: Record<string, RoleRuntimeConfig | null>) => void;
}
```

- [ ] **Step 2: 新增内部状态 `overrides`**

```typescript
const [overrides, setOverrides] = useState<Record<string, RoleRuntimeConfig | null>>({});
```

- [ ] **Step 3: 加载全局配置作为默认 override 来源**

在 `useEffect` 加载 `llmConfigStorage.get()` 时，若某角色尚未设置 override，则初始化为：

```typescript
const seedOverride = (profileId: string): RoleRuntimeConfig | null => {
  const existing = overrides[profileId];
  if (existing !== undefined) return existing;
  return {
    dialogueSimulationEnabled: globalConfig.dialogueSimulationEnabled,
    dialogueSimulationContent: globalConfig.dialogueSimulationContent,
    knowledgeBaseEnabled: globalConfig.knowledgeBaseEnabled,
    knowledgeBaseContent: globalConfig.knowledgeBaseContent,
  };
};
```

- [ ] **Step 4: 在每个角色选择项下方展开编辑器**

当选中某角色时，下方显示 `RoleRuntimeConfigEditor`，值绑定 `overrides[profileId]`。

```typescript
{isSelected && (
  <div className="mt-2 pl-6">
    <RoleRuntimeConfigEditor
      value={overrides[profile.id] ?? null}
      onChange={value => setOverrides(prev => ({ ...prev, [profile.id]: value }))}
    />
  </div>
)}
```

- [ ] **Step 5: 确认时传递 overrides**

```typescript
const handleConfirm = () => {
  onConfirm(selectedDrafts, overrides);
  onClose();
};
```

- [ ] **Step 6: 运行 lint 与 type-check**

Run: `pnpm -F @extension/sidepanel lint && pnpm -F @extension/sidepanel type-check`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add pages/side-panel/src/components/MultiRolePickerModal.tsx
pnpm -F @extension/sidepanel lint && pnpm -F @extension/sidepanel type-check
if [ $? -eq 0 ]; then git commit -m "feat(multi-role): per-role config in MultiRolePickerModal"; fi
```

---

### Task 5: 在 `SidePanel.tsx` 多角色视图中暴露编辑入口

**Files:**
- Modify: `pages/side-panel/src/SidePanel.tsx`

**Interfaces:**
- Consumes: `multiRole.updateRoleRuntimeConfig`（Task 2）；`RoleRuntimeConfigEditor`（Task 3）。
- Produces: 折叠角色卡片展开后显示「运行配置」区域，可实时修改并立即生效。

- [ ] **Step 1: 在多角色折叠卡片渲染处找到展开态分支**

当前 `SidePanel.tsx` 中多角色视图大致在 `multiRole.isMultiRoleMode && multiRole.batch` 分支。定位到角色卡片展开态（`activeRoleIndex === roleIndex`）的渲染代码。

- [ ] **Step 2: 在展开态插入配置编辑器**

```typescript
{isExpanded && (
  <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
    {/* 最近消息摘要保留 */}
    {/* ... */}

    <div>
      <h4 className="mb-2 text-xs font-semibold text-slate-600">该角色运行配置</h4>
      <RoleRuntimeConfigEditor
        value={role.runtimeConfigOverride}
        onChange={value => multiRole.updateRoleRuntimeConfig(roleIndex, value)}
      />
    </div>
  </div>
)}
```

- [ ] **Step 3: 在 `MultiRolePickerModal` 调用处传递 overrides 给 `startBatch`**

```typescript
<MultiRolePickerModal
  isOpen={isMultiRolePickerOpen}
  onClose={() => setIsMultiRolePickerOpen(false)}
  onConfirm={(drafts, overrides) => {
    void multiRole.startBatch(drafts, overrides);
    setIsMultiRolePickerOpen(false);
  }}
/>
```

- [ ] **Step 4: 运行 lint 与 type-check**

Run: `pnpm -F @extension/sidepanel lint && pnpm -F @extension/sidepanel type-check`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pages/side-panel/src/SidePanel.tsx
pnpm -F @extension/sidepanel lint && pnpm -F @extension/sidepanel type-check
if [ $? -eq 0 ]; then git commit -m "feat(multi-role): expose per-role config editor in side panel"; fi
```

---

### Task 6: 补充 `buildStudentRoleSystemPrompt` 单元测试

**Files:**
- Create: `pages/side-panel/src/__tests__/llm-service-runtime-override.test.ts`

**Interfaces:**
- Consumes: `buildStudentRoleSystemPrompt`（需先在 `llm-service.ts` 导出）。
- Produces: 两条测试用例，验证 override 优先级与全局回退。

- [ ] **Step 1: 在 `llm-service.ts` 中导出 `buildStudentRoleSystemPrompt`**

```typescript
export {
  buildStudentRoleSystemPrompt,
  fetchAvailableTextModels,
  generateSimulationDialogueRecord,
  generateStudentAnswer,
  normalizeDialogueSimulationContent,
  testLLMConfig,
};
```

- [ ] **Step 2: 创建测试文件**

```typescript
import { describe, it, expect } from 'vitest';
import { buildStudentRoleSystemPrompt } from '../services/llm-service';

describe('buildStudentRoleSystemPrompt runtime override', () => {
  const baseConfig = {
    dialogueSimulationEnabled: true,
    dialogueSimulationContent: 'AI: 全局问题\n用户: 全局回答',
    knowledgeBaseEnabled: true,
    knowledgeBaseContent: '全局知识库',
  };

  const profile = {
    label: '测试学生',
    description: '测试描述',
    style: '测试风格',
    fallbackHint: '',
  };

  it('prefers runtime override dialogue content over global config', () => {
    const result = buildStudentRoleSystemPrompt('system', profile, baseConfig, {
      dialogueSimulationEnabled: true,
      dialogueSimulationContent: 'AI: 角色专属问题\n用户: 角色专属回答',
      knowledgeBaseEnabled: false,
      knowledgeBaseContent: '',
    });

    expect(result).toContain('角色专属问题');
    expect(result).not.toContain('全局问题');
  });

  it('falls back to global config when override is not provided', () => {
    const result = buildStudentRoleSystemPrompt('system', profile, baseConfig);
    expect(result).toContain('全局问题');
    expect(result).toContain('全局知识库');
  });
});
```

- [ ] **Step 3: 确认 sidepanel 已配置 vitest**

检查 `pages/side-panel/package.json` 中是否存在 `test` script 与 `vitest` 依赖。若不存在，本任务改为纯类型级回归，在 Task 1 的测试占位处标记 SKIP，并在 plan 中记录 "需后续补充测试基础设施"。

- [ ] **Step 4: 运行测试**

Run: `pnpm -F @extension/sidepanel test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pages/side-panel/src/__tests__/llm-service-runtime-override.test.ts pages/side-panel/src/services/llm-service.ts
pnpm -F @extension/sidepanel test && pnpm -F @extension/sidepanel lint
if [ $? -eq 0 ]; then git commit -m "test(multi-role): add runtime override tests"; fi
```

---

### Task 7: 生成器新增自定义提示词模式（服务层类型与提示词构建）

> Task 7-9 与 Task 1-6 相互独立，可任意先后执行；但 Task 7 与 Task 1 都会修改 `llm-service.ts`，两个任务不要并行。

**Files:**
- Modify: `pages/side-panel/src/services/llm-service.ts`
- Test: `pages/side-panel/src/__tests__/llm-service-custom-generation.test.ts`

**Interfaces:**
- Consumes: 现有 `GeneratorProfile`、`GENERATOR_PROFILE_LABELS`、`GENERATOR_PROFILE_GUIDANCE`、`buildSimulationStageDialogueMessages`、`generateSimulationDialogueStage`、`generateSimulationDialogueRecord`（均在 `llm-service.ts` 内）。
- Produces: `PresetGeneratorProfile = 'good' | 'medium' | 'poor'`；`GeneratorProfile = PresetGeneratorProfile | 'custom'`；`SimulationDialogueGenerationParams` 新增 `customInstruction?: string`；`buildSimulationStageDialogueMessages(profile, stage, stageIndex, totalStages, isConciseRetry?, customInstruction?)` 被导出供测试与 Task 8 使用。

- [ ] **Step 1: 拆分档位类型**

把现有 `type GeneratorProfile = 'good' | 'medium' | 'poor';`（约 line 80）替换为：

```typescript
type PresetGeneratorProfile = 'good' | 'medium' | 'poor';
type GeneratorProfile = PresetGeneratorProfile | 'custom';
```

- [ ] **Step 2: 扩展生成参数类型**

```typescript
interface SimulationDialogueGenerationParams {
  trainTaskId: string;
  profile: GeneratorProfile;
  /** profile === 'custom' 时必填，例如「好学生走 A 路径」 */
  customInstruction?: string;
  onProgress?: (progress: SimulationGenerationProgress) => void;
}

interface StageDialogueGenerationParams {
  config: LLMConfig;
  profile: GeneratorProfile;
  stage: DialogueGeneratorStage;
  stageIndex: number;
  totalStages: number;
  modelsToTry: string[];
  isConciseRetry?: boolean;
  customInstruction?: string;
}
```

- [ ] **Step 3: 收窄预设文案 Record 的 key 类型（文案内容不变）**

```typescript
const GENERATOR_PROFILE_LABELS: Record<PresetGeneratorProfile, string> = {
  good: '好学生',
  medium: '一般学生',
  poor: '差学生',
};

const GENERATOR_PROFILE_GUIDANCE: Record<PresetGeneratorProfile, string> = {
  good: '目标是最佳通关路线。学生基本回答正确，尽量用最少轮次满足阶段目标并触发进入下一阶段，不要故意绕路。',
  medium: '目标是可通关的真实引导过程。学生首轮通常只答对 60%-70%，需要 2-3 轮逐步补全，在阶段可用轮次内达标。',
  poor: '目标是边界测试。学生可偏题、误解或回答不完整，重点体现智能体如何把学生往回拉；如果轮次不足，允许该阶段仍未达标。',
};
```

- [ ] **Step 4: 改写 `buildSimulationStageDialogueMessages` 支持自定义模式**

整个函数替换为（system 消息内容不变；预设分支的所有文案与现状逐字相同）：

```typescript
const buildSimulationStageDialogueMessages = (
  profile: GeneratorProfile,
  stage: DialogueGeneratorStage,
  stageIndex: number,
  totalStages: number,
  isConciseRetry = false,
  customInstruction = '',
): ChatMessage[] => {
  const maxRounds = Math.max(1, stage.interactiveRounds);
  const roundInstruction = isConciseRetry
    ? `只生成 1 轮。AI 和用户回答都必须非常短，优先保证完整闭合，不要超过 ${maxRounds} 轮上限。`
    : `生成 1 到 ${maxRounds} 轮，不要超过 interactiveRounds 上限；如果 interactiveRounds 为 0，也生成 1 轮用于保留阶段记录。`;

  const profileLines =
    profile === 'custom'
      ? ['当前生成模式：自定义提示词', `自定义生成要求：${customInstruction.trim() || '(未提供)'}`]
      : [`当前要生成的学生档位：${GENERATOR_PROFILE_LABELS[profile]} (${profile})`, GENERATOR_PROFILE_GUIDANCE[profile]];

  const constraintLines =
    profile === 'custom'
      ? [
          '1. 学生行为、答题质量与路径选择必须严格符合上面的自定义生成要求。',
          '2. AI 话术必须贴合该阶段的 llmPrompt、角色设定和开场白。',
          '3. 用户回答必须符合自定义生成要求，且围绕阶段目标推进。',
        ]
      : [
          '1. 好学生走最佳通关路线，尽量用最少轮次达标；一般学生保留被引导过程；差学生可用于边界测试，不强制通关。',
          '2. AI 话术必须贴合该阶段的 llmPrompt、角色设定和开场白。',
          '3. 用户回答必须符合档位特点，且围绕阶段目标推进。',
        ];

  return [
    {
      role: 'system',
      content: [
        '你是训练剧本模拟对话生成器。',
        '你的唯一任务是根据剧本配置生成“历史对话日志风格”的纯净文本。',
        '只允许输出日志内容，不要输出解释、标题、代码块、分析或额外说明。',
        '每条对话块必须严格使用以下格式：',
        'Step: <stepName> | step_id: <stepId> | 第 <n> 轮 | 来源: chat',
        'AI: <智能体话术>',
        '用户: <学生回答>',
        `${DIALOGUE_LOG_SEPARATOR}`,
        '每一轮都必须包含上述 4 行，不能缺少分隔线。',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        ...profileLines,
        '',
        `当前只生成第 ${stageIndex + 1}/${totalStages} 阶段，禁止输出其他阶段。`,
        `轮次要求：${roundInstruction}`,
        '',
        '生成约束：',
        ...constraintLines,
        '4. 输出中不要使用 Markdown 标题、列表、代码块或解释性文字。',
        '5. 每一轮 Step 行中的 stepName 与 step_id 必须使用下方真实值。',
        ...(isConciseRetry ? ['6. 这是截断后的精简重试：压缩表达，只保留达标所需的最短问答。'] : []),
        '',
        '阶段配置：',
        `stepId: ${stage.stepId}`,
        `stepName: ${stage.stepName}`,
        `trainerName: ${stage.trainerName || '未提供'}`,
        `interactiveRounds: ${stage.interactiveRounds}`,
        'prologue:',
        stage.prologue || '(无)',
        'description:',
        stage.description || '(无)',
        'llmPrompt:',
        stage.llmPrompt || '(无)',
      ].join('\n'),
    },
  ];
};
```

- [ ] **Step 5: 在 `generateSimulationDialogueStage` 中透传 `customInstruction`**

```typescript
const generateSimulationDialogueStage = async ({
  config,
  profile,
  stage,
  stageIndex,
  totalStages,
  modelsToTry,
  isConciseRetry = false,
  customInstruction = '',
}: StageDialogueGenerationParams): Promise<LLMResponse> => {
  const messages = buildSimulationStageDialogueMessages(
    profile,
    stage,
    stageIndex,
    totalStages,
    isConciseRetry,
    customInstruction,
  );
  // ...函数其余部分不变
```

- [ ] **Step 6: 在 `generateSimulationDialogueRecord` 中校验并透传**

函数头部改为：

```typescript
const generateSimulationDialogueRecord = async ({
  trainTaskId,
  profile,
  customInstruction,
  onProgress,
}: SimulationDialogueGenerationParams): Promise<LLMResponse> => {
  const config = normalizeLLMConfig(await llmConfigStorage.get());

  if (!config.apiKey.trim()) {
    return { success: false, error: '请先配置 LLM API Key' };
  }

  const trimmedCustomInstruction = customInstruction?.trim() ?? '';
  if (profile === 'custom' && !trimmedCustomInstruction) {
    return { success: false, error: '自定义生成模式需要填写生成要求。' };
  }
```

循环体内两处 `generateSimulationDialogueStage({ ... })` 调用（首次生成与精简重试）都增加一行参数：

```typescript
        customInstruction: trimmedCustomInstruction,
```

- [ ] **Step 7: 更新文件末尾导出**

```typescript
export {
  buildSimulationStageDialogueMessages,
  fetchAvailableTextModels,
  generateSimulationDialogueRecord,
  generateStudentAnswer,
  normalizeDialogueSimulationContent,
  testLLMConfig,
};
export type { GeneratorProfile, PresetGeneratorProfile, RuntimeProfileOverride, SimulationGenerationProgress };
```

> 若 Task 1/6 已执行，导出列表中会多出 `buildStudentRoleSystemPrompt` 与 `generateSimulationDialogueRecord` 等项，按字母序合并即可，不要删除已有导出。

- [ ] **Step 8: 创建测试文件**

创建 `pages/side-panel/src/__tests__/llm-service-custom-generation.test.ts`：

```typescript
import { describe, expect, it } from 'vitest';
import { buildSimulationStageDialogueMessages } from '../services/llm-service';

const stage = {
  stepId: 'step-1',
  stepName: '开场确认',
  interactiveRounds: 2,
  prologue: '你好',
  description: '确认开场',
  llmPrompt: '按开场流程提问',
  trainerName: '教练',
};

describe('buildSimulationStageDialogueMessages custom mode', () => {
  it('injects custom instruction and drops preset guidance in custom mode', () => {
    const messages = buildSimulationStageDialogueMessages('custom', stage, 0, 3, false, '好学生走A路径');
    const userContent = messages[1]?.content ?? '';

    expect(userContent).toContain('自定义生成要求：好学生走A路径');
    expect(userContent).not.toContain('当前要生成的学生档位');
  });

  it('keeps preset guidance for preset profiles', () => {
    const messages = buildSimulationStageDialogueMessages('good', stage, 0, 3);
    const userContent = messages[1]?.content ?? '';

    expect(userContent).toContain('当前要生成的学生档位：好学生 (good)');
    expect(userContent).not.toContain('自定义生成要求');
  });
});
```

> 与 Task 6 相同的前提：检查 `pages/side-panel/package.json` 是否有 `test` script 与 `vitest` 依赖；若没有，本步骤只创建文件不运行，并沿用 Task 6 的「需后续补充测试基础设施」记录。若 `llm-service.ts` 顶层依赖 `chrome.*`（经 `@extension/storage` 引入）导致 node 环境下导入失败，同样按 Task 6 的回退方案处理为类型级回归。

- [ ] **Step 9: 运行类型检查与 lint**

Run: `pnpm -F @extension/sidepanel type-check && pnpm -F @extension/sidepanel lint`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add pages/side-panel/src/services/llm-service.ts pages/side-panel/src/__tests__/llm-service-custom-generation.test.ts
pnpm -F @extension/sidepanel type-check && pnpm -F @extension/sidepanel lint
if [ $? -eq 0 ]; then git commit -m "feat(simulation): add custom-instruction generator profile"; fi
```

---

### Task 8: 自定义模式的流程图路径规划

**Files:**
- Modify: `pages/side-panel/src/services/llm-service.ts`
- Modify: `pages/side-panel/src/__tests__/llm-service-custom-generation.test.ts`

**Interfaces:**
- Consumes: Task 7 的 `trimmedCustomInstruction`；现有 `ScriptStepItem` / `ScriptStepFlow` / `DialogueGeneratorStage` 类型、`callChatCompletion`、`normalizeGeneratedDialogueBlock`、`resolveGeneratorModelCandidates`、`resolveOrderedScriptStages`。
- Produces: `toDialogueGeneratorStage(step)`（内部复用）；`hasBranchingFlows(flows): boolean` 与 `parsePlannedStepIds(content): string[] | null`（导出供测试）；`resolveCustomScriptStages(params): Promise<DialogueGeneratorStage[] | null>`（失败返回 `null` 表示回退默认路径）。

- [ ] **Step 1: 提取 `toDialogueGeneratorStage` 消除三处重复映射**

新增 helper（放在 `resolveOrderedScriptStages` 之前）：

```typescript
const toDialogueGeneratorStage = (step: ScriptStepItem): DialogueGeneratorStage => ({
  stepId: step.stepId,
  stepName: step.stepDetailDTO?.stepName?.trim() || step.stepId,
  interactiveRounds: Math.max(0, step.stepDetailDTO?.interactiveRounds ?? 0),
  prologue: step.stepDetailDTO?.prologue?.trim() || '',
  description: step.stepDetailDTO?.description?.trim() || '',
  llmPrompt: step.stepDetailDTO?.llmPrompt?.trim() || '',
  trainerName: step.stepDetailDTO?.trainerName?.trim() || '',
});
```

并把 `resolveOrderedScriptStages` 中 while 循环内的 `nodeStages.push({ ...7 个字段... })` 改为 `nodeStages.push(toDialogueGeneratorStage(nextStep));`，末尾 fallback 的 `.map(step => ({ ...7 个字段... }))` 改为 `.map(toDialogueGeneratorStage)`。

- [ ] **Step 2: 新增分支检测与流程图描述**

```typescript
const hasBranchingFlows = (flows: ScriptStepFlow[]) => {
  const outgoingCounts = new Map<string, number>();
  for (const flow of flows) {
    outgoingCounts.set(flow.scriptStepStartId, (outgoingCounts.get(flow.scriptStepStartId) ?? 0) + 1);
  }

  return [...outgoingCounts.values()].some(count => count > 1);
};

const buildFlowGraphDescription = (steps: ScriptStepItem[], flows: ScriptStepFlow[]) => {
  const stepLines = steps.map(step => {
    const detail = step.stepDetailDTO;
    const description = detail?.description?.trim().slice(0, 60) || '(无描述)';

    return `- ${step.stepId} | ${detail?.stepName?.trim() || '(未命名)'} | 类型: ${detail?.nodeType ?? 'UNKNOWN'} | 描述: ${description}`;
  });
  const flowLines = flows.map(
    flow => `- ${flow.scriptStepStartId} -> ${flow.scriptStepEndId}${flow.isDefault === 1 ? ' (默认连线)' : ''}`,
  );

  return ['节点列表：', ...stepLines, '', '连线列表：', ...flowLines].join('\n');
};
```

- [ ] **Step 3: 新增路径规划消息构建与结果解析**

```typescript
const buildPathPlanningMessages = (graphDescription: string, customInstruction: string): ChatMessage[] => [
  {
    role: 'system',
    content: [
      '你是训练剧本路径规划器。',
      '给你一个剧本流程图（节点列表 + 有向连线列表）和一条自定义生成要求。',
      '请从 SCRIPT_START 节点出发，沿连线方向选出一条最符合自定义要求的完整路径。',
      '只输出一个 JSON 数组：路径上按顺序排列的 SCRIPT_NODE 节点 stepId，不包含 SCRIPT_START 和 SCRIPT_END。',
      '不要输出解释、代码块标记或其他任何内容。',
    ].join('\n'),
  },
  {
    role: 'user',
    content: [`自定义生成要求：${customInstruction}`, '', graphDescription].join('\n'),
  },
];

const parsePlannedStepIds = (content: string): string[] | null => {
  try {
    const parsed = JSON.parse(normalizeGeneratedDialogueBlock(content)) as unknown;
    if (!Array.isArray(parsed) || !parsed.length) {
      return null;
    }
    if (!parsed.every((item): item is string => typeof item === 'string' && Boolean(item.trim()))) {
      return null;
    }

    const ids = parsed.map(item => item.trim());
    return new Set(ids).size === ids.length ? ids : null;
  } catch {
    return null;
  }
};
```

- [ ] **Step 4: 新增 `resolveCustomScriptStages`**

```typescript
interface CustomPathPlanningParams {
  config: LLMConfig;
  modelsToTry: string[];
  steps: ScriptStepItem[];
  flows: ScriptStepFlow[];
  customInstruction: string;
}

const resolveCustomScriptStages = async ({
  config,
  modelsToTry,
  steps,
  flows,
  customInstruction,
}: CustomPathPlanningParams): Promise<DialogueGeneratorStage[] | null> => {
  const stepMap = new Map(steps.map(step => [step.stepId, step]));
  const startStepId = steps.find(step => step.stepDetailDTO?.nodeType === 'SCRIPT_START')?.stepId;
  if (!startStepId) {
    return null;
  }

  const adjacency = new Set(flows.map(flow => `${flow.scriptStepStartId}->${flow.scriptStepEndId}`));
  const messages = buildPathPlanningMessages(buildFlowGraphDescription(steps, flows), customInstruction);

  for (const model of modelsToTry) {
    const result = await callChatCompletion(config, model, messages, { temperature: 0, maxTokens: 1024 });
    if (!result.success || !result.content) {
      continue;
    }

    const plannedStepIds = parsePlannedStepIds(result.content);
    if (!plannedStepIds) {
      continue;
    }

    const allNodesValid = plannedStepIds.every(
      stepId => stepMap.get(stepId)?.stepDetailDTO?.nodeType === 'SCRIPT_NODE',
    );
    const pathConnected =
      adjacency.has(`${startStepId}->${plannedStepIds[0]}`) &&
      plannedStepIds.slice(1).every((stepId, index) => adjacency.has(`${plannedStepIds[index]}->${stepId}`));

    if (allNodesValid && pathConnected) {
      return plannedStepIds.flatMap(stepId => {
        const step = stepMap.get(stepId);
        return step ? [toDialogueGeneratorStage(step)] : [];
      });
    }
  }

  console.warn('自定义路径规划失败，回退默认通关路径。');
  return null;
};
```

- [ ] **Step 5: 在 `generateSimulationDialogueRecord` 中集成规划**

把现有片段：

```typescript
    const orderedStages = resolveOrderedScriptStages(steps, flowResponse?.data ?? []);
    if (!orderedStages.length) {
      return { success: false, error: '未识别到默认通关路径上的有效阶段' };
    }

    const modelsToTry = await resolveGeneratorModelCandidates(config);
```

替换为：

```typescript
    const flows = flowResponse?.data ?? [];
    const modelsToTry = await resolveGeneratorModelCandidates(config);

    let orderedStages = resolveOrderedScriptStages(steps, flows);
    if (profile === 'custom' && hasBranchingFlows(flows)) {
      const plannedStages = await resolveCustomScriptStages({
        config,
        modelsToTry,
        steps,
        flows,
        customInstruction: trimmedCustomInstruction,
      });
      if (plannedStages?.length) {
        orderedStages = plannedStages;
      }
    }

    if (!orderedStages.length) {
      return { success: false, error: '未识别到默认通关路径上的有效阶段' };
    }
```

- [ ] **Step 6: 导出测试所需 helper**

在文件末尾导出块中追加 `hasBranchingFlows` 与 `parsePlannedStepIds`（按字母序插入）。

- [ ] **Step 7: 追加测试用例**

在 `llm-service-custom-generation.test.ts` 追加：

```typescript
import { hasBranchingFlows, parsePlannedStepIds } from '../services/llm-service';

describe('custom path planning helpers', () => {
  it('detects branching flows', () => {
    expect(
      hasBranchingFlows([
        { scriptStepStartId: 'a', scriptStepEndId: 'b' },
        { scriptStepStartId: 'a', scriptStepEndId: 'c' },
      ]),
    ).toBe(true);
    expect(hasBranchingFlows([{ scriptStepStartId: 'a', scriptStepEndId: 'b' }])).toBe(false);
  });

  it('parses valid JSON step id arrays and rejects invalid payloads', () => {
    expect(parsePlannedStepIds('["s1","s2"]')).toEqual(['s1', 's2']);
    expect(parsePlannedStepIds('```json\n["s1"]\n```')).toEqual(['s1']);
    expect(parsePlannedStepIds('not json')).toBeNull();
    expect(parsePlannedStepIds('["s1","s1"]')).toBeNull();
    expect(parsePlannedStepIds('[]')).toBeNull();
  });
});
```

> 导入语句与 Task 7 的导入合并为一条 `import { buildSimulationStageDialogueMessages, hasBranchingFlows, parsePlannedStepIds } from '../services/llm-service';`。vitest 基础设施缺失时的回退同 Task 7 Step 8。

- [ ] **Step 8: 运行类型检查与 lint**

Run: `pnpm -F @extension/sidepanel type-check && pnpm -F @extension/sidepanel lint`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add pages/side-panel/src/services/llm-service.ts pages/side-panel/src/__tests__/llm-service-custom-generation.test.ts
pnpm -F @extension/sidepanel type-check && pnpm -F @extension/sidepanel lint
if [ $? -eq 0 ]; then git commit -m "feat(simulation): plan custom script path over flow graph"; fi
```

---

### Task 9: `SimulationConfigModal` 增加「自定义」档位 UI

**Files:**
- Modify: `pages/side-panel/src/components/SimulationConfigModal.tsx`

**Interfaces:**
- Consumes: Task 7 的 `GeneratorProfile`（含 `'custom'`）与 `generateSimulationDialogueRecord` 的 `customInstruction` 参数。
- Produces: 生成器区域四张档位卡片（好/一般/差/自定义）；选中「自定义」时出现必填的提示词输入框。

- [ ] **Step 1: 在 `GENERATOR_PROFILE_OPTIONS` 末尾追加自定义档位**

```typescript
  {
    value: 'custom',
    label: '自定义',
    description: '用自定义提示词控制生成，例如「好学生走 A 路径」。',
  },
```

- [ ] **Step 2: 档位卡片网格从 3 列改为 2 列**

把 `<div className="mt-3 grid gap-2 sm:grid-cols-3">` 改为 `<div className="mt-3 grid gap-2 sm:grid-cols-2">`（4 张卡片呈 2×2）。

- [ ] **Step 3: 新增 `customInstruction` 状态**

在 `generatorProfile` 状态声明旁新增：

```typescript
  const [customInstruction, setCustomInstruction] = useState('');
```

- [ ] **Step 4: 选中自定义档时渲染提示词输入框**

在档位卡片网格 `</div>` 之后、`generateProgressText` 渲染之前插入：

```tsx
                {generatorProfile === 'custom' && (
                  <div className="mt-3">
                    <label
                      htmlFor="customGeneratorInstruction"
                      className="mb-1.5 block text-xs font-medium text-sky-900">
                      自定义生成要求
                    </label>
                    <textarea
                      id="customGeneratorInstruction"
                      value={customInstruction}
                      onChange={event => setCustomInstruction(event.target.value)}
                      disabled={isGenerating}
                      rows={3}
                      placeholder="例如：生成一个好学生，在路由分支处选择 A 路径，其余阶段按最佳路线快速通关。"
                      className="w-full resize-y rounded-lg border border-sky-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                    />
                    <p className="mt-1 text-xs text-sky-700">
                      剧本存在分支时，会先按你的要求在流程图中规划路径，再逐阶段生成对话；规划失败自动回退默认路径。
                    </p>
                  </div>
                )}
```

- [ ] **Step 5: `handleGenerate` 增加校验并透传参数**

```typescript
  const handleGenerate = async () => {
    if (!trainTaskId) {
      setGenerateError('当前未识别到训练任务，无法根据剧本生成模拟对话。');
      return;
    }

    const trimmedCustomInstruction = customInstruction.trim();
    if (generatorProfile === 'custom' && !trimmedCustomInstruction) {
      setGenerateError('请先填写自定义生成要求。');
      return;
    }

    setIsGenerating(true);
    setGenerateError(null);
    setGenerateProgress(null);

    try {
      const result = await generateSimulationDialogueRecord({
        trainTaskId,
        profile: generatorProfile,
        customInstruction: generatorProfile === 'custom' ? trimmedCustomInstruction : undefined,
        onProgress: setGenerateProgress,
      });
      // ...try 块其余部分与 finally 不变
```

- [ ] **Step 6: 生成按钮增加自定义档空内容禁用**

```tsx
                    disabled={isGenerating || !trainTaskId || (generatorProfile === 'custom' && !customInstruction.trim())}
```

- [ ] **Step 7: 运行 lint 与 type-check**

Run: `pnpm -F @extension/sidepanel lint && pnpm -F @extension/sidepanel type-check`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add pages/side-panel/src/components/SimulationConfigModal.tsx
pnpm -F @extension/sidepanel lint && pnpm -F @extension/sidepanel type-check
if [ $? -eq 0 ]; then git commit -m "feat(simulation): custom instruction generator option in modal"; fi
```

---

## Self-Review

**1. Spec coverage：**
- P0 约束（共享全局配置）保留：当 `runtimeConfigOverride` 为 `null` 时完全走全局配置 ✅
- P1 目标（每角色独立知识库/对话剧本）覆盖：Task 1-5 完成类型、LLM 服务、Hook、选择弹窗、侧栏编辑 ✅
- 不持久化 / 零 schema 改动：所有 override 仅存于 `RoleRunState` 内存态 ✅
- 手动输入仅发当前角色：未改动该链路 ✅
- 单角色主链路零变化：`useAgentChat` 未被修改 ✅
- 三档预设生成保持不变：预设分支的提示词文案逐字保留，默认路径解析逻辑仅做等价重构（`toDialogueGeneratorStage` 提取）✅
- 自定义提示词生成：Task 7（类型 + 提示词注入）+ Task 9（UI 档位卡片与输入框）✅
- 路由场景（如「好学生走 A 路径」）：Task 8 在有分支的 flow 图上做 LLM 路径规划，校验节点类型与连通性，失败静默回退默认路径 ✅
- 逐阶段生成机制未被改动（自定义模式只是替换阶段序列与档位指引）✅

**2. Placeholder scan：**
- 无 "TBD" / "TODO" / "implement later" ✅
- 测试步骤若缺 vitest 基础设施有明确回退方案（Task 6/7/8 统一口径）✅

**3. Type consistency：**
- `RoleRuntimeConfig` 在 Task 1 定义，Task 2-5 使用同名同结构 ✅
- `generateStudentAnswer` 第三个参数始终为 `RuntimeProfileOverride | undefined` ✅
- `GeneratorProfile = PresetGeneratorProfile | 'custom'` 在 Task 7 定义，Task 8 集成、Task 9 UI 复用同一联合类型 ✅
- `customInstruction` 链路一致：`SimulationDialogueGenerationParams` → `StageDialogueGenerationParams` → `buildSimulationStageDialogueMessages` 均为可选 string ✅
- `resolveCustomScriptStages` 返回 `DialogueGeneratorStage[] | null`，与 `resolveOrderedScriptStages` 的元素类型一致 ✅

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-06-multi-role-p1-independent-config.md`.

Two execution options:

1. **Subagent-Driven (recommended)** - dispatch a fresh subagent per task, with spec compliance + code quality review between tasks.
2. **Inline Execution** - execute tasks in this session using `superpowers:executing-plans`.

Which approach would you like?
