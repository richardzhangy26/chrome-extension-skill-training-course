# 能力训练 Pro 元数据上下文集成实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为能力训练 Pro 补齐元数据上下文层：拉取 Pro 专用接口、按阶段组装受控上下文并注入学生作答生成；同时修复 Pro 页 `taskId` 提取，且不影响普通能力训练。

**Architecture:** 新增独立 `pro-training-context-service.ts`（纯组装函数 + prompt 片段构造 + 3 接口并行拉取）；`llm-service` 扩展第三参数 `proContext`（向后兼容）；background 提取回退 `trainTaskId ?? taskId`；`useProAgentChat` 会话开始拉取并缓存上下文、按阶段选择、失败禁用 AI。

**Tech Stack:** TypeScript + React（MV3 侧边栏），浏览器 `fetch`（经 background `API_REQUEST` + `ai-poly` Cookie），`node:test --experimental-strip-types`（可直接 import 无 `@extension/*` 依赖的 `.ts`）。

**Spec:** `docs/superpowers/specs/2026-07-16-pro-training-context-design.md`

## Global Constraints

- 命令在仓库根目录执行；根工作区 Node >= 22.15.1、pnpm@10.11.0。
- ESLint 严格：只用箭头函数表达式；`export` 统一放文件末尾；未使用 catch 变量写 `catch {}`；2 空格缩进；React hooks 用 `useX`。ESLint 覆盖 `*.{ts,tsx}`；`eslint-plugin-prettier` 全局生效，`.mjs` 也被 prettier 检查（若报格式用 `npx eslint --fix <file>`，只改格式不改断言）。
- 不新增任何 npm 依赖；不改存储 schema；不改 Admin Web、text/voice/多角色的运行行为与 prompt。
- 接口字段依据 `docs/ability-training-pro-api.md`（2026-07-16 实测）。3 个接口：steps/list、tasks/detail 用 `taskId`；global-roles/list 用 `trainTaskId`（值相同）。本期不拉 skills/list。
- 合法空值不当失败：`tasks/detail.supervisorPrompt`、系统角色 `prompt`、`skills/list[].content`、步骤的 `skills/skillList`。
- 参与角色注入只用 `roleName/nickname/description`，绝不注入完整 `prompt`。
- 日志只记路径/HTTP 状态/业务 code/traceId/条数/字段是否存在；不输出 Cookie/Authorization/完整请求头。
- 本仓有并行会话改 `SidePanel.tsx` 等；每个任务前先 `git log --oneline -3` 与 `git status` 确认基线，行号锚点以代码文本为准。
- 分支：`feat/pro-training-trainv2`（trainV2 集成已在此分支完成，本计划在其上叠加）。

## 文件结构

| 文件 | 操作 | 职责 |
| --- | --- | --- |
| `pages/side-panel/src/services/pro-training-context-service.ts` | 新建 | 类型 + 纯组装（字段提取/extConfig 回退/participantRoles/阶段查找）+ `buildProContextSections` prompt 片段 + `fetchProTrainingContext` 网络 |
| `pages/side-panel/src/services/pro-training-context-service.test.mjs` | 新建 | 上述纯函数行为测试（可直接 import，`background-bridge` 无 `@extension` 依赖，import 安全） |
| `pages/side-panel/src/services/llm-service.ts` | 修改 | `RuntimeProfileOverride` 加 `proContext?`、`profile` 改可选；`buildStudentRoleSystemPrompt` 加可选 `proContext` 调 `buildProContextSections`；`generateStudentAnswer` 透传 |
| `pages/side-panel/src/services/llm-service.proContext.test.mjs` | 新建 | 源码正则测试（llm-service 依赖 `@extension/storage`，node 无法 import，沿用 `llm-service.headers.test.mjs` 模式）确认接线 |
| `chrome-extension/src/background/extract-task-id.ts` | 新建 | 纯函数 `readTaskIdFromUrl(url): string \| null` = `trainTaskId ?? taskId` |
| `chrome-extension/src/background/extract-task-id.test.mjs` | 新建 | 纯函数行为测试 |
| `chrome-extension/src/background/index.ts` | 修改 | `handleExtractTrainTaskId` 改用 `readTaskIdFromUrl` |
| `pages/side-panel/src/hooks/useProAgentChat.ts` | 修改 | start 拉取并缓存上下文、按阶段选择传 `proContext`、失败禁用 AI、任务名改用 context |

---

### Task 1: Pro 训练上下文服务

**Files:**
- Create: `pages/side-panel/src/services/pro-training-context-service.ts`
- Test: `pages/side-panel/src/services/pro-training-context-service.test.mjs`

**Interfaces:**
- Consumes: `apiRequest` from `./background-bridge`（`apiRequest<T>({endpoint, method}): Promise<T>`，`endpoint` 以 `http` 开头时用整串 URL）。
- Produces（Task 2、Task 4 依赖）:
  - types: `ProParticipantRole`、`ProStudentRole`、`ProStageContext`、`ProTrainingContext`、`ProStagePromptContext`
  - `fetchProTrainingContext(taskId: string): Promise<ProTrainingContext>`
  - `toStagePromptContext(stage: ProStageContext, taskName: string, taskDescription: string): ProStagePromptContext`
  - `buildProContextSections(proContext: ProStagePromptContext): string[]`
  - 纯组装：`extractStudentRole`、`buildRolesById`、`buildParticipantRoles`、`assembleProContext`

- [ ] **Step 1: 写失败测试**

创建 `pages/side-panel/src/services/pro-training-context-service.test.mjs`：

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractStudentRole,
  buildRolesById,
  buildParticipantRoles,
  assembleProContext,
  toStagePromptContext,
  buildProContextSections,
} from './pro-training-context-service.ts';

test('extractStudentRole: 顶层字段优先，extConfig 回退', () => {
  assert.deepEqual(extractStudentRole({ nid: 's', userRoleName: '医生', userAssignName: '张医生', userDescription: '接诊' }), {
    roleName: '医生',
    assignName: '张医生',
    description: '接诊',
  });
  assert.deepEqual(
    extractStudentRole({ nid: 's', extConfig: { userRoleName: '客户', userAssignName: '李先生', userDescription: '咨询' } }),
    { roleName: '客户', assignName: '李先生', description: '咨询' },
  );
  assert.deepEqual(extractStudentRole({ nid: 's' }), { roleName: '', assignName: '', description: '' });
});

test('buildParticipantRoles: 剔除 user，查表命中，缺失跳过', () => {
  const rolesById = buildRolesById([
    { nid: 'r1', roleName: '小研', nickname: '研究员', description: '负责分析', prompt: '机密提示词' },
    { nid: 'r2', roleName: '大鲜', nickname: '鲜哥', description: '负责采购' },
  ]);
  const roles = buildParticipantRoles(['r1', 'user', 'r2', 'rX'], rolesById);
  assert.deepEqual(roles, [
    { roleName: '小研', nickname: '研究员', description: '负责分析' },
    { roleName: '大鲜', nickname: '鲜哥', description: '负责采购' },
  ]);
  // 不泄露 prompt
  assert.ok(!JSON.stringify(roles).includes('机密提示词'));
});

test('assembleProContext: 按 nid 建 stagesById，字段映射，空值成空串', () => {
  const ctx = assembleProContext(
    [
      {
        nid: 'step1',
        stepName: '阶段一',
        description: '判断参数',
        llmPrompt: '场景说明',
        stepLlmPromptMemberRoleNidList: ['r1', 'user'],
        userRoleName: '学员',
        userDescription: '待评估',
      },
      { nid: 'step2' },
    ],
    { trainTaskName: '果蔬保鲜', description: '任务说明' },
    [{ nid: 'r1', roleName: '小研', nickname: '研究员', description: '分析' }],
  );
  assert.equal(ctx.taskName, '果蔬保鲜');
  assert.equal(ctx.taskDescription, '任务说明');
  const s1 = ctx.stagesById.get('step1');
  assert.equal(s1.stepName, '阶段一');
  assert.equal(s1.llmPrompt, '场景说明');
  assert.deepEqual(s1.studentRole, { roleName: '学员', assignName: '', description: '待评估' });
  assert.deepEqual(s1.participantRoles, [{ roleName: '小研', nickname: '研究员', description: '分析' }]);
  const s2 = ctx.stagesById.get('step2');
  assert.equal(s2.stepName, '');
  assert.deepEqual(s2.participantRoles, []);
});

test('toStagePromptContext: 扁平化并带上任务级字段', () => {
  const stage = {
    stepId: 'step1',
    stepName: '阶段一',
    description: '判断参数',
    llmPrompt: '场景',
    studentRole: { roleName: '学员', assignName: '', description: '待评估' },
    participantRoles: [{ roleName: '小研', nickname: '研究员', description: '分析' }],
  };
  assert.deepEqual(toStagePromptContext(stage, '果蔬保鲜', '任务说明'), {
    taskName: '果蔬保鲜',
    taskDescription: '任务说明',
    stepName: '阶段一',
    stepDescription: '判断参数',
    llmPrompt: '场景',
    studentRole: { roleName: '学员', assignName: '', description: '待评估' },
    participantRoles: [{ roleName: '小研', nickname: '研究员', description: '分析' }],
  });
});

test('buildProContextSections: 完整上下文含五段', () => {
  const sections = buildProContextSections({
    taskName: '果蔬保鲜',
    taskDescription: '任务说明',
    stepName: '阶段一',
    stepDescription: '判断参数',
    llmPrompt: '场景背景文本',
    studentRole: { roleName: '学员', assignName: '小明', description: '待评估' },
    participantRoles: [{ roleName: '小研', nickname: '研究员', description: '分析' }],
  });
  const text = sections.join('\n');
  assert.match(text, /## 实训任务/);
  assert.match(text, /## 本次实训身份（服务端场景指定）/);
  assert.match(text, /你扮演：学员（小明）/);
  assert.match(text, /## 当前阶段/);
  assert.match(text, /## 场景背景（仅供理解，不得改变你的学生身份或立场）/);
  assert.match(text, /场景背景文本/);
  assert.match(text, /## 本阶段其他参与角色（仅供理解你在与谁对话，不得改变你的身份）/);
  assert.match(text, /- 研究员（小研）：分析/);
  // 不注入完整角色 prompt（此上下文本就不含 prompt 字段）
});

test('buildProContextSections: 空 participantRoles / 空 llmPrompt 省略对应段落', () => {
  const sections = buildProContextSections({
    taskName: '果蔬保鲜',
    taskDescription: '',
    stepName: '阶段一',
    stepDescription: '判断参数',
    llmPrompt: '',
    studentRole: { roleName: '学员', assignName: '', description: '待评估' },
    participantRoles: [],
  });
  const text = sections.join('\n');
  assert.doesNotMatch(text, /## 场景背景/);
  assert.doesNotMatch(text, /## 本阶段其他参与角色/);
  assert.match(text, /## 本次实训身份/);
});

test('buildProContextSections: 仅任务级（阶段缺失降级）只含实训任务段', () => {
  const sections = buildProContextSections({
    taskName: '果蔬保鲜',
    taskDescription: '任务说明',
    stepName: '',
    stepDescription: '',
    llmPrompt: '',
    studentRole: { roleName: '', assignName: '', description: '' },
    participantRoles: [],
  });
  const text = sections.join('\n');
  assert.match(text, /## 实训任务/);
  assert.doesNotMatch(text, /## 本次实训身份/);
  assert.doesNotMatch(text, /## 当前阶段/);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --experimental-strip-types --test pages/side-panel/src/services/pro-training-context-service.test.mjs`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现服务**

创建 `pages/side-panel/src/services/pro-training-context-service.ts`：

```typescript
/**
 * 能力训练 Pro 元数据上下文服务
 * 拉取 Pro 专用接口（steps/list、tasks/detail、global-roles/list），按阶段组装受控上下文，
 * 并构造注入学生作答生成的 prompt 片段。字段依据 docs/ability-training-pro-api.md（2026-07-16 实测）。
 * 参与角色只保留 roleName/nickname/description，绝不注入完整 prompt。
 */

import { apiRequest } from './background-bridge';

interface ProParticipantRole {
  roleName: string;
  nickname: string;
  description: string;
}

interface ProStudentRole {
  roleName: string;
  assignName: string;
  description: string;
}

interface ProStageContext {
  stepId: string;
  stepName: string;
  description: string;
  llmPrompt: string;
  studentRole: ProStudentRole;
  participantRoles: ProParticipantRole[];
}

interface ProTrainingContext {
  taskName: string;
  taskDescription: string;
  stagesById: Map<string, ProStageContext>;
}

interface ProStagePromptContext {
  taskName: string;
  taskDescription: string;
  stepName: string;
  stepDescription: string;
  llmPrompt: string;
  studentRole: ProStudentRole;
  participantRoles: ProParticipantRole[];
}

// 服务端原始响应（宽松类型，仅取需要的字段）
interface ProStepRaw {
  nid?: string;
  stepName?: string;
  description?: string;
  llmPrompt?: string;
  stepLlmPromptMemberRoleNidList?: string[];
  userRoleName?: string;
  userAssignName?: string;
  userDescription?: string;
  extConfig?: { userRoleName?: string; userAssignName?: string; userDescription?: string } | null;
}

interface ProTaskDetailRaw {
  trainTaskName?: string;
  description?: string;
}

interface ProRoleRaw {
  nid?: string;
  roleName?: string;
  nickname?: string;
  description?: string;
}

interface PolymasEnvelope<T> {
  code?: number;
  success?: boolean;
  data?: T;
}

const PRO_API_HOST = 'https://cloudapi.polymas.com';

const str = (value: unknown): string => (typeof value === 'string' ? value : '');

const extractStudentRole = (step: ProStepRaw): ProStudentRole => ({
  roleName: str(step.userRoleName ?? step.extConfig?.userRoleName),
  assignName: str(step.userAssignName ?? step.extConfig?.userAssignName),
  description: str(step.userDescription ?? step.extConfig?.userDescription),
});

const buildRolesById = (roles: ProRoleRaw[]): Map<string, ProParticipantRole> => {
  const map = new Map<string, ProParticipantRole>();
  for (const role of roles) {
    if (!role.nid) {
      continue;
    }
    map.set(role.nid, {
      roleName: str(role.roleName),
      nickname: str(role.nickname),
      description: str(role.description),
    });
  }
  return map;
};

const buildParticipantRoles = (
  memberNidList: string[] | undefined,
  rolesById: Map<string, ProParticipantRole>,
): ProParticipantRole[] => {
  const result: ProParticipantRole[] = [];
  for (const nid of memberNidList ?? []) {
    if (nid === 'user') {
      continue;
    }
    const role = rolesById.get(nid);
    if (role) {
      result.push(role);
    }
  }
  return result;
};

const assembleProContext = (steps: ProStepRaw[], detail: ProTaskDetailRaw, roles: ProRoleRaw[]): ProTrainingContext => {
  const rolesById = buildRolesById(roles);
  const stagesById = new Map<string, ProStageContext>();
  for (const step of steps) {
    if (!step.nid) {
      continue;
    }
    stagesById.set(step.nid, {
      stepId: step.nid,
      stepName: str(step.stepName),
      description: str(step.description),
      llmPrompt: str(step.llmPrompt),
      studentRole: extractStudentRole(step),
      participantRoles: buildParticipantRoles(step.stepLlmPromptMemberRoleNidList, rolesById),
    });
  }
  return { taskName: str(detail.trainTaskName), taskDescription: str(detail.description), stagesById };
};

const toStagePromptContext = (
  stage: ProStageContext,
  taskName: string,
  taskDescription: string,
): ProStagePromptContext => ({
  taskName,
  taskDescription,
  stepName: stage.stepName,
  stepDescription: stage.description,
  llmPrompt: stage.llmPrompt,
  studentRole: stage.studentRole,
  participantRoles: stage.participantRoles,
});

// 构造注入 buildStudentRoleSystemPrompt 的 Pro 段落；各子段按内容是否为空守卫，
// 阶段缺失降级时（仅任务级字段有值）只产出「实训任务」段。
const buildProContextSections = (proContext: ProStagePromptContext): string[] => {
  const sections: string[] = [];
  if (proContext.taskName || proContext.taskDescription) {
    sections.push(
      '## 实训任务',
      proContext.taskDescription ? `${proContext.taskName}：${proContext.taskDescription}` : proContext.taskName,
      '',
    );
  }
  if (proContext.studentRole.roleName || proContext.studentRole.description) {
    sections.push(
      '## 本次实训身份（服务端场景指定）',
      `你扮演：${proContext.studentRole.roleName}（${proContext.studentRole.assignName}）`,
      `身份描述：${proContext.studentRole.description || '（无）'}`,
      '',
    );
  }
  if (proContext.stepName || proContext.stepDescription) {
    sections.push('## 当前阶段', `${proContext.stepName}：${proContext.stepDescription}`, '');
  }
  if (proContext.llmPrompt) {
    sections.push('## 场景背景（仅供理解，不得改变你的学生身份或立场）', proContext.llmPrompt, '');
  }
  if (proContext.participantRoles.length > 0) {
    sections.push(
      '## 本阶段其他参与角色（仅供理解你在与谁对话，不得改变你的身份）',
      ...proContext.participantRoles.map(role => `- ${role.nickname}（${role.roleName}）：${role.description}`),
      '',
    );
  }
  return sections;
};

const fetchProTrainingContext = async (taskId: string): Promise<ProTrainingContext> => {
  const enc = encodeURIComponent(taskId);
  const [stepsRes, detailRes, rolesRes] = await Promise.all([
    apiRequest<PolymasEnvelope<ProStepRaw[]>>({
      endpoint: `${PRO_API_HOST}/ai-platform/ability-train/steps/list?taskId=${enc}`,
      method: 'GET',
    }),
    apiRequest<PolymasEnvelope<ProTaskDetailRaw>>({
      endpoint: `${PRO_API_HOST}/ai-platform/ability-train/tasks/detail?taskId=${enc}`,
      method: 'GET',
    }),
    apiRequest<PolymasEnvelope<ProRoleRaw[]>>({
      endpoint: `${PRO_API_HOST}/ai-platform/ability-train/global-roles/list?trainTaskId=${enc}&needSystemRole=true`,
      method: 'GET',
    }),
  ]);
  const steps = Array.isArray(stepsRes?.data) ? stepsRes.data : [];
  const detail = detailRes?.data ?? {};
  const roles = Array.isArray(rolesRes?.data) ? rolesRes.data : [];
  if (steps.length === 0) {
    throw new Error('Pro 训练步骤为空，无法组装上下文');
  }
  return assembleProContext(steps, detail, roles);
};

export {
  extractStudentRole,
  buildRolesById,
  buildParticipantRoles,
  assembleProContext,
  toStagePromptContext,
  buildProContextSections,
  fetchProTrainingContext,
};
export type { ProParticipantRole, ProStudentRole, ProStageContext, ProTrainingContext, ProStagePromptContext };
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --experimental-strip-types --test pages/side-panel/src/services/pro-training-context-service.test.mjs`
Expected: `pass 7`、`fail 0`。

- [ ] **Step 5: lint 与类型检查**

Run: `pnpm -F @extension/sidepanel lint && pnpm -F @extension/sidepanel type-check`
Expected: 均无错误（若 prettier 报 `.mjs` 格式，`npx eslint --fix pages/side-panel/src/services/pro-training-context-service.test.mjs` 后复跑测试）。

- [ ] **Step 6: Commit**

```bash
git add pages/side-panel/src/services/pro-training-context-service.ts pages/side-panel/src/services/pro-training-context-service.test.mjs
git commit -m "feat(side-panel): add pro training context service"
```

---

### Task 2: llm-service 注入 proContext

**Files:**
- Modify: `pages/side-panel/src/services/llm-service.ts`（`RuntimeProfileOverride` 定义；`buildStudentRoleSystemPrompt`；`generateStudentAnswer`）
- Test: `pages/side-panel/src/services/llm-service.proContext.test.mjs`

**Interfaces:**
- Consumes: Task 1 的 `buildProContextSections`、类型 `ProStagePromptContext`。
- Produces（Task 4 依赖）: `generateStudentAnswer(aiQuestion, history, { proContext })` 接受可选 `proContext`；`RuntimeProfileOverride.profile` 变可选、新增 `proContext?`。

- [ ] **Step 1: 写失败测试**

创建 `pages/side-panel/src/services/llm-service.proContext.test.mjs`（源码正则，沿用 `llm-service.headers.test.mjs` 模式，因 llm-service 依赖 `@extension/storage` 无法在 node 中 import）：

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';

const source = readFileSync(new URL('./llm-service.ts', import.meta.url), 'utf8');

const overrideBlock = source.match(/interface RuntimeProfileOverride \{[\s\S]*?\n\}/);
const builder = source.match(/const buildStudentRoleSystemPrompt = \([\s\S]*?\n\};/);
const generator = source.match(/const generateStudentAnswer = async \([\s\S]*?\n\};/);

test('RuntimeProfileOverride: profile 可选并新增 proContext', () => {
  assert.ok(overrideBlock, '应能定位 RuntimeProfileOverride');
  assert.match(overrideBlock[0], /profile\?: StudentProfile/, 'profile 应改为可选');
  assert.match(overrideBlock[0], /proContext\?: ProStagePromptContext/, '应新增可选 proContext');
});

test('buildStudentRoleSystemPrompt: 接收可选 proContext 并调用 buildProContextSections', () => {
  assert.ok(builder, '应能定位 buildStudentRoleSystemPrompt');
  assert.match(builder[0], /proContext\?: ProStagePromptContext/, '应新增可选 proContext 参数');
  assert.match(builder[0], /if \(proContext\)/, '应按存在与否守卫');
  assert.match(builder[0], /buildProContextSections\(proContext\)/, '应调用 buildProContextSections 追加段落');
});

test('generateStudentAnswer: 把 runtimeOverride?.proContext 透传给 buildStudentRoleSystemPrompt', () => {
  assert.ok(generator, '应能定位 generateStudentAnswer');
  assert.match(generator[0], /runtimeOverride\?\.proContext/, '应读取 runtimeOverride?.proContext');
});

test('从 pro-training-context-service 导入 buildProContextSections 与类型', () => {
  assert.match(source, /import \{ buildProContextSections \} from '\.\/pro-training-context-service'/);
  assert.match(source, /import type \{ ProStagePromptContext \} from '\.\/pro-training-context-service'/);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test pages/side-panel/src/services/llm-service.proContext.test.mjs`
Expected: FAIL（尚未改 llm-service）。

- [ ] **Step 3: 改 llm-service.ts**

1）文件顶部 import 区加入（值导入与类型导入分开，`import` 语句允许在文件中部；沿用现有 import 分组风格，放在其它 `./` 相对导入附近）：

```typescript
import { buildProContextSections } from './pro-training-context-service';
```

以及类型导入（与现有 `import type { LLMConfig, StudentProfile } from '@extension/storage';` 同区）：

```typescript
import type { ProStagePromptContext } from './pro-training-context-service';
```

2）`RuntimeProfileOverride` 定义改为：

```typescript
interface RuntimeProfileOverride {
  profile?: StudentProfile;
  runtimeConfigOverride?: RoleRuntimeConfig;
  proContext?: ProStagePromptContext;
}
```

3）`buildStudentRoleSystemPrompt` 增加可选末参并在返回前追加 Pro 段落。签名从：

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
```

改为（加 `proContext` 末参）：

```typescript
const buildStudentRoleSystemPrompt = (
  systemPrompt: string,
  profile: { label: string; description: string; style: string; fallbackHint?: string },
  config: Pick<
    LLMConfig,
    'dialogueSimulationEnabled' | 'dialogueSimulationContent' | 'knowledgeBaseEnabled' | 'knowledgeBaseContent'
  >,
  runtimeConfigOverride?: RoleRuntimeConfig,
  proContext?: ProStagePromptContext,
) => {
```

在该函数体内、最后 `sections.push('## 回复规则', ...)` 之前，插入：

```typescript
  if (proContext) {
    sections.push(...buildProContextSections(proContext));
  }

```

（即紧接在知识库 `if (knowledgeBaseContent) { ... }` 块之后、`sections.push('## 回复规则',` 之前。）

4）`generateStudentAnswer` 内调用 `buildStudentRoleSystemPrompt` 处透传 proContext。从：

```typescript
    const roleSystemPrompt = buildStudentRoleSystemPrompt(
      systemPrompt,
      profile,
      config,
      runtimeOverride?.runtimeConfigOverride,
    );
```

改为：

```typescript
    const roleSystemPrompt = buildStudentRoleSystemPrompt(
      systemPrompt,
      profile,
      config,
      runtimeOverride?.runtimeConfigOverride,
      runtimeOverride?.proContext,
    );
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test pages/side-panel/src/services/llm-service.proContext.test.mjs`
Expected: `pass 4`、`fail 0`。

- [ ] **Step 5: 回归 + lint + type-check**

Run: `node --test pages/side-panel/src/services/llm-service.headers.test.mjs && pnpm -F @extension/sidepanel lint && pnpm -F @extension/sidepanel type-check`
Expected: 全部通过（现有 headers 测试不受影响；类型检查确认 `profile?` 可选后 `runtimeOverride?.profile ?? resolveStudentProfile(config)` 仍成立、多角色调用不报错）。

- [ ] **Step 6: Commit**

```bash
git add pages/side-panel/src/services/llm-service.ts pages/side-panel/src/services/llm-service.proContext.test.mjs
git commit -m "feat(side-panel): inject optional pro context into student prompt"
```

---

### Task 3: background 提取回退 taskId

**Files:**
- Create: `chrome-extension/src/background/extract-task-id.ts`
- Test: `chrome-extension/src/background/extract-task-id.test.mjs`
- Modify: `chrome-extension/src/background/index.ts`（`handleExtractTrainTaskId`）

**Interfaces:**
- Produces: `readTaskIdFromUrl(url: string): string | null`（`trainTaskId` 优先，回退 `taskId`）。

- [ ] **Step 1: 写失败测试**

创建 `chrome-extension/src/background/extract-task-id.test.mjs`：

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { readTaskIdFromUrl } from './extract-task-id.ts';

test('普通训练页：读取 trainTaskId', () => {
  assert.equal(readTaskIdFromUrl('https://x.com/train?trainTaskId=ABC123'), 'ABC123');
});

test('Pro 运行页：回退读取 taskId', () => {
  assert.equal(readTaskIdFromUrl('https://x.com/pro?taskId=PROuNODZ41RAJttrEuzs'), 'PROuNODZ41RAJttrEuzs');
});

test('两者都有时 trainTaskId 优先', () => {
  assert.equal(readTaskIdFromUrl('https://x.com/p?taskId=T2&trainTaskId=T1'), 'T1');
});

test('都没有返回 null', () => {
  assert.equal(readTaskIdFromUrl('https://x.com/p?foo=bar'), null);
});

test('非法 URL 返回 null', () => {
  assert.equal(readTaskIdFromUrl('not a url'), null);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --experimental-strip-types --test chrome-extension/src/background/extract-task-id.test.mjs`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现纯函数**

创建 `chrome-extension/src/background/extract-task-id.ts`：

```typescript
/**
 * 从训练页 URL 提取训练任务 ID。
 * 普通能力训练页用 `trainTaskId`；能力训练 Pro 运行页用 `taskId`（实测）。
 * 优先 `trainTaskId`，回退 `taskId`，向后兼容普通页。
 */

const readTaskIdFromUrl = (url: string): string | null => {
  try {
    const params = new URL(url).searchParams;
    return params.get('trainTaskId') ?? params.get('taskId');
  } catch {
    return null;
  }
};

export { readTaskIdFromUrl };
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --experimental-strip-types --test chrome-extension/src/background/extract-task-id.test.mjs`
Expected: `pass 5`、`fail 0`。

- [ ] **Step 5: 接入 index.ts**

在 `chrome-extension/src/background/index.ts` 顶部 import 区加入：

```typescript
import { readTaskIdFromUrl } from './extract-task-id';
```

`handleExtractTrainTaskId` 中把：

```typescript
    const urlObj = new URL(targetUrl);
    const trainTaskId = urlObj.searchParams.get('trainTaskId');

    if (!trainTaskId) {
      return { success: false, error: 'trainTaskId not found in URL' };
    }

    return { success: true, data: trainTaskId };
```

改为：

```typescript
    const trainTaskId = readTaskIdFromUrl(targetUrl);

    if (!trainTaskId) {
      return { success: false, error: 'trainTaskId not found in URL' };
    }

    return { success: true, data: trainTaskId };
```

（`targetUrl` 上一步已确保非空；`readTaskIdFromUrl` 内部自带 try/catch，可删除原先只为 `new URL` 的外层无关代码，但保留函数已有的整体 try/catch 结构。）

- [ ] **Step 6: lint + type-check（chrome-extension 工作区）**

Run: `pnpm -F chrome-extension lint && pnpm -F chrome-extension type-check`
Expected: 无错误（若 prettier 报 `.mjs` 格式，`npx eslint --fix chrome-extension/src/background/extract-task-id.test.mjs` 后复跑测试）。

- [ ] **Step 7: Commit**

```bash
git add chrome-extension/src/background/extract-task-id.ts chrome-extension/src/background/extract-task-id.test.mjs chrome-extension/src/background/index.ts
git commit -m "fix(background): extract taskId fallback for pro training page"
```

---

### Task 4: useProAgentChat 接入上下文

**Files:**
- Modify: `pages/side-panel/src/hooks/useProAgentChat.ts`

**Interfaces:**
- Consumes: Task 1 的 `fetchProTrainingContext`、`toStagePromptContext`、类型 `ProTrainingContext`、`ProStagePromptContext`；Task 2 扩展后的 `generateStudentAnswer(aiQuestion, history, { proContext })`。
- Produces: Pro 会话开始拉取并缓存上下文；学生 AI 作答带上当前阶段 proContext；上下文失败时禁用 AI 生成（手动不受限）；任务名改用 context。

- [ ] **Step 1: 顶部 import 与移除旧任务名请求**

在 import 区加入：

```typescript
import { fetchProTrainingContext, toStagePromptContext } from '../services/pro-training-context-service';
```

以及类型：

```typescript
import type { ProTrainingContext, ProStagePromptContext } from '../services/pro-training-context-service';
```

删除仅服务于旧任务名请求的代码（已核实这些符号在 hook 内仅被 `fetchTrainTaskName` 及其唯一调用点使用，删除后无残留引用）：`interface TrainConfigurationResponse`、`interface ApiResponse<T>`、`const fetchTrainTaskName = async (...) => {...}`（整块），以及顶部 `import { apiRequest, API_ENDPOINTS } from '../services/background-bridge';`（整行删除）。Step 4 会一并移除其在 `Promise.all` 中的调用点。

- [ ] **Step 2: 新增 refs**

在 hook 内 refs 声明区（`stageEntryRunningRef` 附近）加入：

```typescript
  const proContextRef = useRef<ProTrainingContext | null>(null);
  const proContextErrorRef = useRef(false);
```

- [ ] **Step 3: generateAndSend 带上 proContext 并在上下文失败时禁用**

把 `generateAndSend` 改为（在配置校验后加上下文失败短路；按当前 stepId 选阶段并降级）：

```typescript
  const generateAndSend = useCallback(
    async (seq: number): Promise<{ needConfig: boolean; ok: boolean }> => {
      const config = await llmConfigStorage.get();
      if (!config.apiKey) {
        return { needConfig: true, ok: false };
      }
      if (proContextErrorRef.current) {
        addMessage('system', '⚠️ 未获取到 Pro 训练上下文，AI 作答暂不可用，可手动作答或重试');
        return { needConfig: false, ok: false };
      }
      setIsGenerating(true);
      try {
        const { aiQuestion, history } = buildStudentAnswerInput(turnsRef.current);
        const ctx = proContextRef.current;
        let proContext: ProStagePromptContext | undefined;
        if (ctx) {
          const stage = stepIdRef.current ? ctx.stagesById.get(stepIdRef.current) : undefined;
          if (stage) {
            proContext = toStagePromptContext(stage, ctx.taskName, ctx.taskDescription);
          } else {
            // 阶段缺失：降级用任务级上下文（buildProContextSections 会只产出「实训任务」段）
            console.warn('[pro] 当前阶段不在上下文缓存中，降级用任务级上下文', stepIdRef.current);
            proContext = {
              taskName: ctx.taskName,
              taskDescription: ctx.taskDescription,
              stepName: '',
              stepDescription: '',
              llmPrompt: '',
              studentRole: { roleName: '', assignName: '', description: '' },
              participantRoles: [],
            };
          }
        }
        const result = await generateStudentAnswer(aiQuestion, history, proContext ? { proContext } : undefined);
        if (!isRunningSeq(seq) || turnPhaseRef.current !== 'USER_TURN') {
          return { needConfig: false, ok: false };
        }
        if (!result.success || !result.content || !result.content.trim()) {
          setError(result.error ?? 'AI 生成失败');
          addMessage('system', `⚠️ AI 生成失败：${result.error ?? '未知错误'}，请手动输入或重试`);
          return { needConfig: false, ok: false };
        }
        submitStudentText(result.content, { isAutoGenerated: true, modelId: config.model });
        return { needConfig: false, ok: true };
      } finally {
        setIsGenerating(false);
      }
    },
    [addMessage, isRunningSeq, submitStudentText],
  );
```

- [ ] **Step 4: start() 拉取上下文（失败只禁用 AI，不终止会话）**

在 `start` 内，把现有：

```typescript
    try {
      const [userInfo, resolvedTaskName, trainingMeta] = await Promise.all([
        fetchPolymasUserInfo(),
        fetchTrainTaskName(trainTaskId),
        resolveTrainingMetadata(),
      ]);
      const taskDisplayName = resolvedTaskName || trainTaskId;
```

改为：

```typescript
    proContextRef.current = null;
    proContextErrorRef.current = false;
    try {
      const [userInfo, trainingMeta] = await Promise.all([fetchPolymasUserInfo(), resolveTrainingMetadata()]);
      let taskDisplayName = trainTaskId;
      try {
        const proContext = await fetchProTrainingContext(trainTaskId);
        proContextRef.current = proContext;
        if (proContext.taskName) {
          taskDisplayName = proContext.taskName;
        }
      } catch (ctxError) {
        proContextErrorRef.current = true;
        console.warn('[pro] 训练上下文获取失败', ctxError);
        addMessage('system', '⚠️ 未获取到 Pro 训练上下文，AI 作答暂不可用，可手动作答或重试');
      }
```

（其后 `const config = await llmConfigStorage.get();` 起的日志会话创建、`addMessage('system', 训练任务：${taskDisplayName})`、WS handlers 与 connect 逻辑保持不变。注意 `taskDisplayName` 由 `const` 变为 `let`。）

- [ ] **Step 5: reset() 清理上下文缓存**

在 `reset` 内已有的清理（`logSessionIdRef.current = null;` 附近）追加：

```typescript
    proContextRef.current = null;
    proContextErrorRef.current = false;
```

- [ ] **Step 6: lint + type-check**

Run: `pnpm -F @extension/sidepanel lint && pnpm -F @extension/sidepanel type-check`
Expected: 均无错误。若 ESLint 报 `react-hooks/exhaustive-deps`，按提示补依赖（勿禁用规则）。若报删除后的 `apiRequest`/`API_ENDPOINTS`/接口未使用，确认已一并删除。

- [ ] **Step 7: Commit**

```bash
git add pages/side-panel/src/hooks/useProAgentChat.ts
git commit -m "feat(side-panel): wire pro training context into student generation"
```

---

### Task 5: 全量验证与手动 e2e

**Files:** 无新增；缺陷修复单独提交。

- [ ] **Step 1: 全部自动化检查**

```bash
node --experimental-strip-types --test \
  pages/side-panel/src/services/pro-training-context-service.test.mjs \
  chrome-extension/src/background/extract-task-id.test.mjs
node --test \
  pages/side-panel/src/services/llm-service.proContext.test.mjs \
  pages/side-panel/src/services/llm-service.headers.test.mjs \
  pages/side-panel/src/services/pro-conversation.test.mjs \
  pages/side-panel/src/services/ws/train-v2-client.test.mjs \
  pages/side-panel/src/SidePanel.idle-controls.test.mjs
pnpm -F @extension/sidepanel lint && pnpm -F @extension/sidepanel type-check
pnpm -F chrome-extension lint && pnpm -F chrome-extension type-check
pnpm build
```

Expected: 全部测试通过、lint/类型无错、`dist/` 生产构建成功。

- [ ] **Step 2: 手动 e2e（真实 Pro 任务页）**

前置：`chrome://extensions` 加载 `dist/`；登录 `hike-teaching-center.polymas.com`；打开 URL 含 `taskId=PRO…` 的 Pro 运行页；配好 LLM API Key。

逐条验证并记录：

1. **提取修复**：进入 Pro 页后侧边栏能提取到任务 ID、开始按钮可用（此前 `taskId` 页拿不到 ID，无法开始）。
2. **上下文注入**：开始训练 → 学生 AI 作答体现服务端身份（userRoleName/描述）与当前阶段场景；多阶段推进时身份/阶段随 `nextStepId` 切换；参与角色只以昵称/名称/描述出现，不泄露完整 prompt。
3. **失败降级**：断网或令牌失效制造上下文拉取失败 → 出现「⚠️ 未获取到 Pro 训练上下文」提示、AI 生成/自动运行被禁用、手动输入仍可发送并推进。
4. **普通训练回归**：切到能力训练（text）/口语（voice），确认作答行为与 prompt 与改动前一致（proContext 缺省路径不受影响）。

- [ ] **Step 3:（如有修复）提交并复跑 Step 1**

修复提交示例：`fix(side-panel): <具体缺陷>`；每次修复后复跑 Step 1。

## 手动验证已知风险点

- 三接口经后台 `API_REQUEST` + `ai-poly` Cookie 调用；未登录/令牌失效应走「上下文失败禁用 AI」路径，而非崩溃或盲答。
- `global-roles/list` 用 `trainTaskId` 参数名、其余用 `taskId`（值相同）；参数名写错会 400/空。
- 阶段主要提示词 `llmPrompt` 可能较长；注入后关注 token 预算与生成延迟（本期不截断，若实测超限再议）。
- `taskId` 提取回退是共享改动：回归确认普通训练页（`trainTaskId`）与口语模式不受影响。
```
