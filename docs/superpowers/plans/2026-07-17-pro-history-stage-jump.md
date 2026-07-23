# 能力训练 Pro 历史角色与阶段跳转 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让能力训练 Pro 历史以角色昵称显示，并通过现有调试步骤弹窗创建一个从指定阶段启动的新 Pro 会话，同时清理正常 WebSocket 关闭产生的错误页噪声。

**Architecture:** 历史条目增加可选 `aiRoleName`，Pro 写入结构化昵称与纯正文，扩展和 Admin Web 统一用 `aiRoleName ?? "AI"` 展示。阶段跳转使用独立的一次性目标控制器：关闭旧会话后新建 trainV2 连接，仅替换服务端第一次 `nextStep`，随后恢复正常推进；UI 复用 `DebugStepsModal`。

**Tech Stack:** TypeScript 5、React 19、Chrome MV3、Node `node:test` / `assert`、Zod 4、TanStack Start、Biome、pnpm workspace。

## Global Constraints

- 规格来源：`docs/superpowers/specs/2026-07-17-pro-history-stage-jump-design.md`。
- 所有生产改动必须先有能按预期失败的测试，再写最小实现。
- `aiRoleName` 必须是可选字段；旧本地历史和旧云端历史无需迁移并继续显示。
- 普通文字、口语和多角色训练不写 `aiRoleName`，继续显示 `AI:`。
- Pro 选择阶段必须关闭旧 WebSocket、保留旧历史并创建新日志 session；禁止在旧会话中直接强发目标 `stepStart`。
- 目标 `stepId` 必须来自当前任务最新 Pro 步骤列表，并且只替换首次 `nextStep`。
- 不新增 Chrome 权限、运行时依赖、数据库迁移或 Polymas/Admin Web 鉴权通道。
- 不修改生成的 `manifest.json`、`admin_web/src/routeTree.gen.ts` 或用户未跟踪文件。
- 扩展代码遵循箭头函数、文件末尾集中 export、跨 workspace 使用 `@extension/*`；Admin Web 使用 `@/` 与 Biome。
- 每个任务单独提交；提交前只暂存该任务列出的文件。

---

## File Structure

### 新增文件

- `pages/side-panel/src/services/history-log-format.ts`：扩展历史的纯展示/导出格式化函数。
- `pages/side-panel/src/services/history-log-format.test.mjs`：普通与 Pro 历史标签回归测试。
- `pages/side-panel/src/services/pro-stage-start-target.ts`：一次性 Pro 定向阶段控制器。
- `pages/side-panel/src/services/pro-stage-start-target.test.mjs`：目标消费、清理与回退测试。
- `pages/side-panel/src/hooks/useProAgentChat.stage-jump.test.mjs`：Hook 接线与旧会话隔离的源码回归测试。
- `pages/side-panel/src/SidePanel.pro-debug.test.mjs`：Pro 调试入口、列表和选择分流回归测试。
- `admin_web/src/lib/agent-log-schema.test.ts`：云端 schema 的新旧数据兼容测试。

### 修改文件

- `packages/storage/lib/impl/agent-log-storage.ts`：为 `ChatLogEntry` 增加可选 `aiRoleName`。
- `pages/side-panel/src/services/pro-conversation.ts`：角色名解析和结构化日志映射。
- `pages/side-panel/src/services/pro-conversation.test.mjs`：Pro 昵称/教练映射测试。
- `pages/side-panel/src/services/pro-training-context-service.ts`：参与角色保留 `nid`，导出调试阶段列表。
- `pages/side-panel/src/services/pro-training-context-service.test.mjs`：角色 `nid` 与阶段列表测试。
- `pages/side-panel/src/components/HistoryModal.tsx`：使用共享历史格式化函数。
- `admin_web/src/lib/agent-log-schema.ts`：接受并保留 `aiRoleName`。
- `admin_web/src/components/settings/history/extension-history-utils.ts`：Admin Web 角色标签回退函数。
- `admin_web/src/components/settings/history/extension-history-utils.test.ts`：Pro/普通角色标签测试。
- `admin_web/src/components/settings/history/extension-history-view.tsx`：详情和 TXT/ZIP 使用角色标签。
- `pages/side-panel/src/hooks/useProAgentChat.ts`：阶段列表、角色回退、新会话定向启动。
- `pages/side-panel/src/components/DebugStepsModal.tsx`：接收普通/Pro 通用步骤视图并显示对应说明。
- `pages/side-panel/src/SidePanel.tsx`：Pro 调试按钮、弹窗数据和选择处理。
- `pages/side-panel/src/services/ws/train-v2-client.ts`：正常关闭降级、移除不透明 error 对象。
- `pages/side-panel/src/services/ws/train-v2-client.test.mjs`：诊断级别和日志参数测试。

---

### Task 1: 结构化 Pro 历史角色与昵称回退

**Files:**
- Modify: `packages/storage/lib/impl/agent-log-storage.ts:12-21`
- Modify: `pages/side-panel/src/services/pro-training-context-service.ts:12-30,58-118`
- Modify: `pages/side-panel/src/services/pro-conversation.ts:8-49`
- Test: `pages/side-panel/src/services/pro-conversation.test.mjs`
- Test: `pages/side-panel/src/services/pro-training-context-service.test.mjs`

**Interfaces:**
- Consumes: trainV2 的 `roleNid / roleNickname / roleName` 与 Pro context 的参与角色。
- Produces: `ChatLogEntry.aiRoleName?: string`、`ProParticipantRole.nid: string`、`ProDebugStage`、`resolveProRoleName()`、结构化 `formatProLogEntry()`。

- [ ] **Step 1: 先把 Pro 日志测试改成期望结构化角色名**

在 `pro-conversation.test.mjs` 将现有日志映射断言改为：

```js
test('formatProLogEntry: user→userText，bot/coach→纯 aiText + aiRoleName', () => {
  assert.deepEqual(formatProLogEntry({ role: 'user', label: '你(学生)', content: '你好' }), { userText: '你好' });
  assert.deepEqual(formatProLogEntry({ role: 'bot', label: '客户', content: '在吗' }), {
    aiText: '在吗',
    aiRoleName: '客户',
  });
  assert.deepEqual(formatProLogEntry({ role: 'coach', label: '教练点评', content: '不错' }), {
    aiText: '不错',
    aiRoleName: '教练点评',
  });
});

test('resolveProRoleName: 忽略空白并按事件昵称、阶段昵称、角色名、对方回退', () => {
  assert.equal(resolveProRoleName({ eventNickname: ' 小研 ', stageNickname: '阶段小研' }), '小研');
  assert.equal(resolveProRoleName({ eventNickname: ' ', stageNickname: ' 阶段小研 ' }), '阶段小研');
  assert.equal(resolveProRoleName({ eventRoleName: ' 咨询顾问 ' }), '咨询顾问');
  assert.equal(resolveProRoleName({}), '对方');
});
```

在 `pro-training-context-service.test.mjs` 增加：

```js
test('assembleProContext: 参与角色保留 nid，调试阶段保持接口顺序', () => {
  const context = assembleProContext(
    [
      { nid: 's1', stepName: '阶段一', stepLlmPromptMemberRoleNidList: ['r1', 'user'] },
      { nid: 's2', stepName: '阶段二', description: '目标阶段' },
    ],
    { trainTaskName: '任务' },
    [{ nid: 'r1', roleName: '顾问', nickname: '小研', description: '答疑' }],
  );

  assert.deepEqual(context.stagesById.get('s1').participantRoles[0], {
    nid: 'r1',
    roleName: '顾问',
    nickname: '小研',
    description: '答疑',
  });
  assert.deepEqual(toProDebugStages(context), [
    { stepId: 's1', stepName: '阶段一', description: '' },
    { stepId: 's2', stepName: '阶段二', description: '目标阶段' },
  ]);
});
```

- [ ] **Step 2: 运行测试并确认 RED**

Run from repository root:

```bash
node --experimental-strip-types --test pages/side-panel/src/services/pro-conversation.test.mjs pages/side-panel/src/services/pro-training-context-service.test.mjs
```

Expected: FAIL；`resolveProRoleName` / `toProDebugStages` 尚未导出，且 bot 日志仍是 `客户: 在吗`。

- [ ] **Step 3: 扩展共享历史类型和 Pro context 类型**

在 `ChatLogEntry` 增加：

```ts
interface ChatLogEntry {
  type: 'chat';
  timestamp: number;
  stepId: string;
  stepName?: string;
  round: number;
  source: AgentLogSource;
  userText?: string;
  aiText?: string;
  aiRoleName?: string;
}
```

在 Pro context 中使用以下类型和转换：

```ts
interface ProParticipantRole {
  nid: string;
  roleName: string;
  nickname: string;
  description: string;
}

interface ProDebugStage {
  stepId: string;
  stepName: string;
  description: string;
}

map.set(role.nid, {
  nid: role.nid,
  roleName: str(role.roleName),
  nickname: str(role.nickname),
  description: str(role.description),
});

const toProDebugStages = (context: ProTrainingContext): ProDebugStage[] =>
  [...context.stagesById.values()].map(stage => ({
    stepId: stage.stepId,
    stepName: stage.stepName || stage.stepId,
    description: stage.description,
  }));
```

从文件末尾导出 `toProDebugStages` 和 `ProDebugStage`。

- [ ] **Step 4: 实现统一角色名解析和结构化日志映射**

在 `pro-conversation.ts` 增加：

```ts
interface ProRoleNameCandidates {
  eventNickname?: string;
  stageNickname?: string;
  eventRoleName?: string;
  currentRoleName?: string;
}

const normalizeLabel = (value: string | undefined): string => value?.trim() ?? '';

const resolveProRoleName = ({
  eventNickname,
  stageNickname,
  eventRoleName,
  currentRoleName,
}: ProRoleNameCandidates): string =>
  [eventNickname, stageNickname, eventRoleName, currentRoleName]
    .map(normalizeLabel)
    .find(Boolean) || '对方';

const formatProLogEntry = (turn: ProTurn): { userText?: string; aiText?: string; aiRoleName?: string } =>
  turn.role === 'user'
    ? { userText: turn.content }
    : { aiText: turn.content, aiRoleName: normalizeLabel(turn.label) || '对方' };
```

保留 `formatOpponentLine()` 只供 LLM 对话上下文使用；从文件末尾导出 `resolveProRoleName` 及其候选类型。

- [ ] **Step 5: 验证 GREEN 并检查两个 workspace**

Run from repository root:

```bash
node --experimental-strip-types --test pages/side-panel/src/services/pro-conversation.test.mjs pages/side-panel/src/services/pro-training-context-service.test.mjs
pnpm -F @extension/storage type-check
pnpm -F @extension/sidepanel type-check
```

Expected: 全部 PASS；普通训练调用点不需要增加字段。

- [ ] **Step 6: 提交 Task 1**

```bash
git add packages/storage/lib/impl/agent-log-storage.ts pages/side-panel/src/services/pro-conversation.ts pages/side-panel/src/services/pro-conversation.test.mjs pages/side-panel/src/services/pro-training-context-service.ts pages/side-panel/src/services/pro-training-context-service.test.mjs
git commit -m "feat(side-panel): persist Pro role names"
```

---

### Task 2: 扩展历史与 Admin Web 使用角色标签

**Files:**
- Create: `pages/side-panel/src/services/history-log-format.ts`
- Create: `pages/side-panel/src/services/history-log-format.test.mjs`
- Modify: `pages/side-panel/src/components/HistoryModal.tsx:24-90,400-420`
- Modify: `admin_web/src/lib/agent-log-schema.ts:3-14`
- Create: `admin_web/src/lib/agent-log-schema.test.ts`
- Modify: `admin_web/src/components/settings/history/extension-history-utils.ts`
- Modify: `admin_web/src/components/settings/history/extension-history-utils.test.ts`
- Modify: `admin_web/src/components/settings/history/extension-history-view.tsx:39-96,450-466`

**Interfaces:**
- Consumes: Task 1 的 `ChatLogEntry.aiRoleName`。
- Produces: 扩展 `getHistoryAiRoleName()` / `buildAgentLogText()`，Admin Web `getHistoryAiRoleName()`，并让 Zod 保留字段。

- [ ] **Step 1: 为扩展历史格式写失败测试**

创建 `history-log-format.test.mjs`：

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAgentLogText, getHistoryAiRoleName } from './history-log-format.ts';

const session = {
  id: 'log-1',
  taskId: 'PRO123',
  taskName: 'Pro 任务',
  createdAt: 1,
  updatedAt: 2,
  entries: [
    { type: 'chat', timestamp: 2, stepId: 's1', stepName: '阶段一', round: 1, source: 'chat', userText: '你好' },
    { type: 'chat', timestamp: 3, stepId: 's1', stepName: '阶段一', round: 1, source: 'chat', aiText: '欢迎', aiRoleName: '小研' },
    { type: 'chat', timestamp: 4, stepId: 's1', stepName: '阶段一', round: 1, source: 'chat', aiText: '普通回答' },
  ],
};

test('Pro 使用 aiRoleName，普通条目回退 AI', () => {
  assert.equal(getHistoryAiRoleName(session.entries[1]), '小研');
  assert.equal(getHistoryAiRoleName(session.entries[2]), 'AI');
  const text = buildAgentLogText(session, value => `time:${value}`);
  assert.match(text, /用户: 你好/);
  assert.match(text, /小研: 欢迎/);
  assert.match(text, /AI: 普通回答/);
  assert.doesNotMatch(text, /AI: 小研:/);
});
```

- [ ] **Step 2: 为 Admin schema 和标签回退写失败测试**

创建 `admin_web/src/lib/agent-log-schema.test.ts`：

```ts
import assert from 'node:assert/strict';
import { agentLogSessionSchema } from './agent-log-schema';

const baseEntry = {
  type: 'chat' as const,
  timestamp: 1,
  stepId: 's1',
  round: 1,
  source: 'chat' as const,
  aiText: '你好',
};

const parse = (entry: typeof baseEntry & { aiRoleName?: string }) =>
  agentLogSessionSchema.parse({
    id: 'log-1',
    taskId: 'PRO123',
    createdAt: 1,
    updatedAt: 2,
    entries: [entry],
  });

assert.equal(parse({ ...baseEntry, aiRoleName: '小研' }).entries[0].aiRoleName, '小研');
assert.equal(parse(baseEntry).entries[0].aiRoleName, undefined);
```

在 `extension-history-utils.test.ts` 增加导入及断言：

```ts
assert.equal(getHistoryAiRoleName({ ...entry(1, 'pro'), aiRoleName: ' 小研 ' }), '小研');
assert.equal(getHistoryAiRoleName(entry(1, 'normal')), 'AI');
```

- [ ] **Step 3: 运行三组测试并确认 RED**

Run from repository root:

```bash
node --experimental-strip-types --test pages/side-panel/src/services/history-log-format.test.mjs
```

Expected: FAIL with module/function missing.

Run from `admin_web/`:

```bash
pnpm exec tsx src/lib/agent-log-schema.test.ts
pnpm exec tsx src/components/settings/history/extension-history-utils.test.ts
```

Expected: schema 测试因 `aiRoleName` 被剥离而 FAIL；工具测试因函数不存在而 FAIL。

- [ ] **Step 4: 创建扩展历史纯格式化模块并接入 HistoryModal**

`history-log-format.ts` 使用以下实现：

```ts
import type { AgentLogEntry, AgentLogSession } from '@extension/storage';

type TimestampFormatter = (timestamp: number) => string;

const getStepDisplayName = (session: AgentLogSession, entry: AgentLogEntry): string =>
  entry.stepName || session.stepNameMapping?.[entry.stepId] || entry.stepId || '未知步骤';

const getSessionDisplayName = (session: AgentLogSession): string =>
  session.taskName?.trim() || session.taskId || session.id;

const getHistoryAiRoleName = (entry: AgentLogEntry): string => entry.aiRoleName?.trim() || 'AI';

const buildAgentLogText = (session: AgentLogSession, formatTimestamp: TimestampFormatter): string => {
  const lines = [
    '对话记录',
    `日志创建时间: ${formatTimestamp(session.createdAt)}`,
    `任务名称: ${getSessionDisplayName(session)}`,
    `task_id: ${session.taskId}`,
    '剧本存放位置: 浏览器本地存储 (chrome.storage.local)',
    '='.repeat(60),
  ];
  for (const entry of session.entries) {
    const roundInfo = entry.round ? ` | 第 ${entry.round} 轮` : '';
    lines.push(`Step: ${getStepDisplayName(session, entry)} | step_id: ${entry.stepId}${roundInfo} | 来源: ${entry.source}`);
    if (entry.userText) lines.push(`用户: ${entry.userText}`);
    if (entry.aiText) lines.push(`${getHistoryAiRoleName(entry)}: ${entry.aiText}`);
    lines.push('-'.repeat(40));
  }
  return lines.join('\n');
};

export { buildAgentLogText, getHistoryAiRoleName, getSessionDisplayName, getStepDisplayName };
```

`HistoryModal.tsx` 删除同名本地函数，导入上述四个函数；下载调用改为
`buildAgentLogText(session, formatTimestamp)`，展开详情标签改为：

```tsx
<span className="font-medium text-emerald-600">{getHistoryAiRoleName(entry)}:</span>
```

- [ ] **Step 5: 让 Admin Web schema、详情和导出保留角色名**

在 schema 条目中加入：

```ts
aiRoleName: z.string().optional(),
```

在 `extension-history-utils.ts` 增加并导出：

```ts
const getHistoryAiRoleName = (entry: AgentLogSessionInput['entries'][number]): string =>
  entry.aiRoleName?.trim() || 'AI';
```

在 `extension-history-view.tsx` 的 TXT 构造与 JSX 详情两处都使用：

```ts
lines.push(`${getHistoryAiRoleName(entry)}: ${entry.aiText}`);
```

```tsx
{getHistoryAiRoleName(entry)}: {entry.aiText}
```

- [ ] **Step 6: 验证扩展、Admin Web 和旧数据兼容**

Run from repository root:

```bash
node --experimental-strip-types --test pages/side-panel/src/services/history-log-format.test.mjs
pnpm -F @extension/storage type-check
pnpm -F @extension/sidepanel lint
pnpm -F @extension/sidepanel type-check
```

Run from `admin_web/`:

```bash
pnpm exec tsx src/lib/agent-log-schema.test.ts
pnpm exec tsx src/components/settings/history/extension-history-utils.test.ts
pnpm check
pnpm build
```

Expected: 全部 PASS；无需生成 D1 migration。

- [ ] **Step 7: 提交 Task 2**

```bash
git add pages/side-panel/src/services/history-log-format.ts pages/side-panel/src/services/history-log-format.test.mjs pages/side-panel/src/components/HistoryModal.tsx admin_web/src/lib/agent-log-schema.ts admin_web/src/lib/agent-log-schema.test.ts admin_web/src/components/settings/history/extension-history-utils.ts admin_web/src/components/settings/history/extension-history-utils.test.ts admin_web/src/components/settings/history/extension-history-view.tsx
git commit -m "feat(history): display Pro role names"
```

---

### Task 3: Pro 新会话定向阶段状态机

**Files:**
- Create: `pages/side-panel/src/services/pro-stage-start-target.ts`
- Create: `pages/side-panel/src/services/pro-stage-start-target.test.mjs`
- Create: `pages/side-panel/src/hooks/useProAgentChat.stage-jump.test.mjs`
- Modify: `pages/side-panel/src/hooks/useProAgentChat.ts`

**Interfaces:**
- Consumes: Task 1 的 `ProDebugStage`、`toProDebugStages()`、`resolveProRoleName()`。
- Produces: `createProStageStartTarget()`、Hook 状态 `debugStages/isStageListLoading/stageListError`，操作 `refreshDebugStages()` 与 `restartAtStage(stepId)`。

- [ ] **Step 1: 为一次性阶段目标写失败测试**

创建 `pro-stage-start-target.test.mjs`：

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { createProStageStartTarget } from './pro-stage-start-target.ts';

test('未请求目标时服从服务端，请求目标只替换一次', () => {
  const target = createProStageStartTarget();
  assert.deepEqual(target.consume('server-1'), { stepId: 'server-1', overrodeServer: false });

  target.request('target-2');
  assert.equal(target.peek(), 'target-2');
  assert.deepEqual(target.consume('server-1'), { stepId: 'target-2', overrodeServer: true });
  assert.equal(target.peek(), null);
  assert.deepEqual(target.consume('server-3'), { stepId: 'server-3', overrodeServer: false });
});

test('目标等于服务端建议时消费目标但不标记 override，clear 可取消', () => {
  const target = createProStageStartTarget();
  target.request('s1');
  assert.deepEqual(target.consume('s1'), { stepId: 's1', overrodeServer: false });
  target.request('s2');
  target.clear();
  assert.deepEqual(target.consume('s1'), { stepId: 's1', overrodeServer: false });
});
```

- [ ] **Step 2: 为 Hook 接线写失败测试**

创建 `useProAgentChat.stage-jump.test.mjs`：

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { URL } from 'node:url';

test('Pro 定向启动在 teardown 后请求目标，并只在 nextStep 消费一次', async () => {
  const source = await readFile(new URL('./useProAgentChat.ts', import.meta.url), 'utf8');
  assert.match(source, /const restartAtStage = useCallback[\s\S]*?teardown\(\)[\s\S]*?beginRun\(stage\)/);
  assert.match(source, /stageStartTargetRef\.current\.request\(requestedStage\.stepId\)/);
  assert.match(source, /stageStartTargetRef\.current\.consume\(payload\.nextStepId\)/);
  assert.match(source, /selection\.overrodeServer[\s\S]*?runStageEntry\(seq\)/);
});

test('teardown、reset 与任务变化路径都会清除未消费目标', async () => {
  const source = await readFile(new URL('./useProAgentChat.ts', import.meta.url), 'utf8');
  assert.match(source, /const teardown = useCallback\(\(\) => \{[\s\S]*?stageStartTargetRef\.current\.clear\(\)/);
  assert.match(source, /taskChangeTracker\.update\(trainTaskId\)[\s\S]*?reset\(\)/);
  assert.match(source, /组件卸载时断开连接[\s\S]*?stageStartTargetRef\.current\.clear\(\)/);
});
```

- [ ] **Step 3: 运行测试并确认 RED**

Run from repository root:

```bash
node --experimental-strip-types --test pages/side-panel/src/services/pro-stage-start-target.test.mjs pages/side-panel/src/hooks/useProAgentChat.stage-jump.test.mjs
```

Expected: FAIL；目标控制器文件和 Hook API 尚不存在。

- [ ] **Step 4: 实现一次性目标控制器**

创建 `pro-stage-start-target.ts`：

```ts
interface ProStageStartSelection {
  stepId: string;
  overrodeServer: boolean;
}

interface ProStageStartTarget {
  request(stepId: string): void;
  consume(serverStepId: string): ProStageStartSelection;
  clear(): void;
  peek(): string | null;
}

const createProStageStartTarget = (): ProStageStartTarget => {
  let requestedStepId: string | null = null;
  return {
    request: stepId => {
      requestedStepId = stepId;
    },
    consume: serverStepId => {
      const target = requestedStepId;
      requestedStepId = null;
      return target
        ? { stepId: target, overrodeServer: target !== serverStepId }
        : { stepId: serverStepId, overrodeServer: false };
    },
    clear: () => {
      requestedStepId = null;
    },
    peek: () => requestedStepId,
  };
};

export { createProStageStartTarget };
export type { ProStageStartSelection, ProStageStartTarget };
```

- [ ] **Step 5: 给 Hook 增加阶段列表与角色回退**

在 Hook 增加状态和同步 ref：

```ts
const [debugStages, setDebugStages] = useState<ProDebugStage[]>([]);
const [isStageListLoading, setIsStageListLoading] = useState(false);
const [stageListError, setStageListError] = useState<string | null>(null);
const debugStagesRef = useRef<ProDebugStage[]>([]);
const stageStartTargetRef = useRef(createProStageStartTarget());

const storeDebugStages = useCallback((stages: ProDebugStage[]) => {
  debugStagesRef.current = stages;
  setDebugStages(stages);
}, []);
```

`teardown()` 在推进 `runSeq` 后立即调用：

```ts
stageStartTargetRef.current.clear();
```

组件卸载 cleanup 在关闭 client 前也显式调用同一句；不要在卸载时调用会写 React state 的完整
`teardown()`。

每次成功获取 context 后：

```ts
const stages = toProDebugStages(proContext);
storeDebugStages(stages);
```

角色事件使用同一个 resolver。当前角色 ref 扩为 `{ nid; nickname; roleName }`，并按当前阶段查找参与角色：

```ts
const getStageRole = (roleNid: string) =>
  proContextRef.current?.stagesById
    .get(stepIdRef.current ?? '')
    ?.participantRoles.find(role => role.nid === roleNid);

const nickname = resolveProRoleName({
  eventNickname: payload.roleNickname,
  stageNickname: getStageRole(payload.roleNid)?.nickname,
  eventRoleName: payload.roleName,
  currentRoleName: currentRoleRef.current?.roleName,
});
```

`botAnswerEnd` 使用同样顺序；教练仍固定 `教练点评`。

- [ ] **Step 6: 把现有 start 主体收敛为 `beginRun(requestedStage)`**

把当前 `const start = useCallback(async () => {` 精确改名并增加参数：

```ts
const beginRun = useCallback(async (requestedStage: ProDebugStage | null = null) => {
  if (!trainTaskId) {
    invalidatePolymasUserInfo();
    setError('未找到训练任务ID，请在训练页面打开');
    return;
  }
  if (clientRef.current || proStateRef.current === 'CONNECTING') return;

  const seq = runSeqRef.current + 1;
  runSeqRef.current = seq;
  stageStartTargetRef.current.clear();
```

上述三行后保留当前 `start()` 中从 `setMessages([])` 到 `client.connect()`/catch 的所有初始化与
runSeq guard；只在下面列出的两个位置插入新逻辑。首先，在最新 context 赋给
`proContextRef.current` 后执行阶段存储、精确校验与目标请求：

```ts
if (requestedStage) {
  const latestStage = proContext.stagesById.get(requestedStage.stepId);
  if (!latestStage) throw new Error(`目标阶段已失效：${requestedStage.stepName}`);
  stageStartTargetRef.current.request(requestedStage.stepId);
  addMessage('system', `调试模式：从阶段 ${latestStage.stepName || requestedStage.stepId} 开始`);
}
```

原 context 内层 catch 在普通启动时继续保留降级行为；定向启动必须中止，不得带空 context 继续连接：

```ts
} catch (ctxError) {
  if (runSeqRef.current !== seq) return;
  if (requestedStage) {
    throw ctxError instanceof Error ? ctxError : new Error('目标阶段上下文获取失败');
  }
  proContextErrorRef.current = true;
  console.warn('[pro] 训练上下文获取失败', ctxError);
  addMessage('system', PRO_CONTEXT_UNAVAILABLE_MESSAGE);
}
```

然后把原 callback 依赖数组替换为以下完整数组，并提供无参数兼容 wrapper：

```ts
}, [
  trainTaskId,
  addMessage,
  autoAnswer,
  endRun,
  failRun,
  recordTurn,
  runStageEntry,
  setProState,
  setTurnPhase,
  storeDebugStages,
]);

const start = useCallback(() => beginRun(null), [beginRun]);
```

不得删除用户刷新、LLM config、日志 session、runSeq guard 或 relay client 创建逻辑，也不得创建第二套初始化路径。

- [ ] **Step 7: 在首次 nextStep 消费目标并按目标阶段执行开场**

替换 handler 的步骤选择段：

```ts
const selection = stageStartTargetRef.current.consume(payload.nextStepId);
stepIdRef.current = selection.stepId;
const stagePosition = debugStagesRef.current.findIndex(stage => stage.stepId === selection.stepId);
stepIndexRef.current = stagePosition >= 0 ? stagePosition + 1 : stepIndexRef.current + 1;
setStepIndex(stepIndexRef.current);
clientRef.current?.sendEvent('stepStart', { stepId: selection.stepId });
if (selection.overrodeServer || stepIndexRef.current >= 2) {
  void runStageEntry(seq);
}
```

后续 `nextStep` 因目标已被消费，自动使用服务端 ID。

- [ ] **Step 8: 实现刷新阶段与新会话重启 API**

```ts
const refreshDebugStages = useCallback(async () => {
  if (!trainTaskId) {
    storeDebugStages([]);
    setStageListError('未找到训练任务ID');
    return;
  }
  setIsStageListLoading(true);
  setStageListError(null);
  try {
    const context = await fetchProTrainingContext(trainTaskId);
    storeDebugStages(toProDebugStages(context));
  } catch (error) {
    setStageListError(error instanceof Error ? error.message : '获取 Pro 阶段失败');
  } finally {
    setIsStageListLoading(false);
  }
}, [storeDebugStages, trainTaskId]);

const restartAtStage = useCallback(
  async (stepId: string) => {
    const stage = debugStagesRef.current.find(item => item.stepId === stepId);
    if (!stage) {
      setError('目标阶段不存在，请刷新阶段列表后重试');
      return;
    }
    teardown();
    setProState('IDLE');
    logSessionIdRef.current = null;
    await beginRun(stage);
  },
  [beginRun, setProState, teardown],
);
```

Hook return 增加：

```ts
debugStages,
isStageListLoading,
stageListError,
refreshDebugStages,
restartAtStage,
```

`reset()` 额外清空阶段列表和列表错误；任务变化路径继续调用 `reset()`。

- [ ] **Step 9: 验证目标控制器、Hook 回归和类型检查**

Run from repository root:

```bash
node --experimental-strip-types --test pages/side-panel/src/services/pro-stage-start-target.test.mjs pages/side-panel/src/hooks/useProAgentChat.stage-jump.test.mjs pages/side-panel/src/hooks/useProAgentChat.user-refresh.test.mjs pages/side-panel/src/services/pro-conversation.test.mjs pages/side-panel/src/services/pro-training-context-service.test.mjs
pnpm -F @extension/sidepanel lint
pnpm -F @extension/sidepanel type-check
```

Expected: 全部 PASS；`start()` 的无参数调用保持兼容。

- [ ] **Step 10: 提交 Task 3**

```bash
git add pages/side-panel/src/services/pro-stage-start-target.ts pages/side-panel/src/services/pro-stage-start-target.test.mjs pages/side-panel/src/hooks/useProAgentChat.stage-jump.test.mjs pages/side-panel/src/hooks/useProAgentChat.ts
git commit -m "feat(side-panel): start Pro training at selected stage"
```

---

### Task 4: 复用调试步骤弹窗接入 Pro

**Files:**
- Create: `pages/side-panel/src/SidePanel.pro-debug.test.mjs`
- Modify: `pages/side-panel/src/components/DebugStepsModal.tsx`
- Modify: `pages/side-panel/src/SidePanel.tsx`

**Interfaces:**
- Consumes: 普通 `scriptSteps` 与 Task 3 的 `pro.debugStages / refreshDebugStages / restartAtStage`。
- Produces: 通用 `DebugStepItem` 和 `variant="standard" | "pro"`，Pro 运行区显示调试入口。

- [ ] **Step 1: 写 UI 接线失败测试**

创建 `SidePanel.pro-debug.test.mjs`：

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { URL } from 'node:url';

test('Pro ChatInput 显示调试入口并打开共用弹窗', async () => {
  const source = await readFile(new URL('./SidePanel.tsx', import.meta.url), 'utf8');
  assert.match(source, /<ProChatArea[\s\S]*?onOpenDebug=\{\(\) => setIsDebugOpen\(true\)\}/);
  assert.match(source, /showDebug=\{true\}/);
  assert.match(source, /mode === 'pro'[\s\S]*?pro\.refreshDebugStages\(\)/);
});

test('选择步骤按当前模式分流，Pro 使用 restartAtStage', async () => {
  const source = await readFile(new URL('./SidePanel.tsx', import.meta.url), 'utf8');
  assert.match(source, /if \(mode === 'pro'\)[\s\S]*?pro\.restartAtStage\(stepId\)/);
  assert.match(source, /variant=\{mode === 'pro' \? 'pro' : 'standard'\}/);
});
```

- [ ] **Step 2: 运行测试并确认 RED**

```bash
node --test pages/side-panel/src/SidePanel.pro-debug.test.mjs
```

Expected: FAIL；Pro 当前 `showDebug={false}`，且没有模式分流。

- [ ] **Step 3: 把 DebugStepsModal 收敛为通用步骤视图**

将组件输入类型改为：

```ts
interface DebugStepItem {
  stepId: string;
  stepName: string;
  stepOrder?: number;
  nodeType?: 'SCRIPT_START' | 'SCRIPT_END' | 'SCRIPT_NODE';
  description?: string;
}

interface DebugStepsModalProps {
  isOpen: boolean;
  steps: DebugStepItem[];
  variant: 'standard' | 'pro';
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
  onRefresh: () => void;
  onSelectStep: (stepId: string) => void;
}
```

名称、过滤与 meta 直接读取平铺字段；说明文字按 variant：

```tsx
<div className="text-sm text-slate-600">
  {variant === 'pro' ? '选择一个阶段，关闭当前会话并从该阶段新建 Pro 会话' : '选择一个步骤直接运行该节点 RunCard'}
</div>
```

从文件末尾导出 `DebugStepItem` 类型。

- [ ] **Step 4: 在 SidePanel 映射普通与 Pro 步骤**

增加两个只读列表：

```ts
const standardDebugSteps: DebugStepItem[] = scriptSteps.map(step => ({
  stepId: step.stepId,
  stepName: step.stepDetailDTO?.stepName?.trim() || step.stepId,
  stepOrder: step.stepDetailDTO?.stepOrder,
  nodeType: step.stepDetailDTO?.nodeType,
}));

const proDebugSteps: DebugStepItem[] = pro.debugStages.map((stage, index) => ({
  stepId: stage.stepId,
  stepName: stage.stepName,
  stepOrder: index + 1,
  nodeType: 'SCRIPT_NODE',
  description: stage.description,
}));
```

弹窗打开 effect 按模式刷新：

```ts
useEffect(() => {
  if (!isDebugOpen) return;
  if (mode === 'pro') {
    void pro.refreshDebugStages();
    return;
  }
  void fetchScriptSteps();
}, [fetchScriptSteps, isDebugOpen, mode, pro.refreshDebugStages]);
```

选择处理按模式分流：

```ts
const handleSelectDebugStep = async (stepId: string) => {
  setIsDebugOpen(false);
  if (mode === 'pro') {
    await pro.restartAtStage(stepId);
    return;
  }
  await runDebugStep(stepId);
};
```

- [ ] **Step 5: 打开 Pro 调试按钮并接入弹窗**

`ProChatAreaProps` 增加 `onOpenDebug: () => void`。Pro 的 `ChatInput` 改为：

```tsx
onOpenDebug={onOpenDebug}
debugDisabled={pro.isGenerating || pro.isStageListLoading}
showDebug={true}
```

主组件传入：

```tsx
onOpenDebug={() => setIsDebugOpen(true)}
```

共用弹窗传入：

```tsx
<DebugStepsModal
  isOpen={isDebugOpen}
  steps={mode === 'pro' ? proDebugSteps : standardDebugSteps}
  variant={mode === 'pro' ? 'pro' : 'standard'}
  isLoading={mode === 'pro' ? pro.isStageListLoading : isStepListLoading}
  error={mode === 'pro' ? pro.stageListError : stepListError}
  onClose={() => setIsDebugOpen(false)}
  onRefresh={() => {
    if (mode === 'pro') void pro.refreshDebugStages();
    else void fetchScriptSteps({ force: true });
  }}
  onSelectStep={handleSelectDebugStep}
/>
```

- [ ] **Step 6: 验证 UI 接线、普通模式回归与类型**

```bash
node --test pages/side-panel/src/SidePanel.pro-debug.test.mjs
pnpm -F @extension/sidepanel lint
pnpm -F @extension/sidepanel type-check
pnpm -F @extension/sidepanel build
```

Expected: 全部 PASS；普通文字模式仍过滤 start/end 节点并调用 `runDebugStep`。

- [ ] **Step 7: 提交 Task 4**

```bash
git add pages/side-panel/src/SidePanel.pro-debug.test.mjs pages/side-panel/src/components/DebugStepsModal.tsx pages/side-panel/src/SidePanel.tsx
git commit -m "feat(side-panel): expose Pro stage jump"
```

---

### Task 5: WebSocket 正常关闭日志降噪

**Files:**
- Modify: `pages/side-panel/src/services/ws/train-v2-client.ts:145-181`
- Modify: `pages/side-panel/src/services/ws/train-v2-client.test.mjs`

**Interfaces:**
- Consumes: `TrainV2CloseInfo` 与连接 phase。
- Produces: `buildTrainV2CloseDiagnostic()`，正常 `1000 + wasClean` 为 debug，异常为 warn；error 日志只输出字符串。

- [ ] **Step 1: 写诊断分类和单参数 error 日志失败测试**

在 `train-v2-client.test.mjs` 增加：

```js
test('clean 1000 close 使用 debug，异常 close 使用 warn', () => {
  assert.deepEqual(buildTrainV2CloseDiagnostic({ code: 1000, reason: 'client close', wasClean: true }, 'connected'), {
    level: 'debug',
    message: '[pro-ws] close code=1000 reason=client close wasClean=true phase=connected',
  });
  assert.equal(buildTrainV2CloseDiagnostic({ code: 1006, reason: '', wasClean: false }, 'handshake').level, 'warn');
});

test('error 事件只向 console.warn 传诊断字符串，不附加不透明对象', async () => {
  const socket = createFakeSocket();
  const calls = [];
  const originalWarn = console.warn;
  console.warn = (...args) => calls.push(args);
  try {
    const client = new TrainV2Client(clientParams, {}, () => socket);
    const connecting = client.connect();
    socket.emitError();
    await assert.rejects(connecting, /WebSocket 连接失败/);
    assert.equal(calls.at(-1).length, 1);
    assert.match(calls.at(-1)[0], /phase=handshake/);
  } finally {
    console.warn = originalWarn;
  }
});
```

同时更新文件顶部导入，加入 `buildTrainV2CloseDiagnostic`。把现有
`OPEN 后主动 close 清理心跳` 测试中的日志捕获从 `console.warn` 改为 `console.debug`，并继续断言
恰好一条 `phase=connected`，从而证明正常关闭不会走 warning。

- [ ] **Step 2: 运行测试并确认 RED**

```bash
node --experimental-strip-types --test pages/side-panel/src/services/ws/train-v2-client.test.mjs
```

Expected: FAIL；diagnostic helper 尚不存在，error 日志当前有两个参数。

- [ ] **Step 3: 实现诊断 helper 并替换日志调用**

在 client 文件加入：

```ts
type TrainV2ConnectionPhase = 'handshake' | 'connected';
type TrainV2DiagnosticLevel = 'debug' | 'warn';

const buildTrainV2CloseDiagnostic = (
  close: TrainV2CloseInfo,
  phase: TrainV2ConnectionPhase,
): { level: TrainV2DiagnosticLevel; message: string } => ({
  level: close.code === 1000 && close.wasClean ? 'debug' : 'warn',
  message: `[pro-ws] close code=${close.code} reason=${close.reason || '(空)'} wasClean=${close.wasClean} phase=${phase}`,
});
```

error listener 只保留字符串：

```ts
console.warn(`[pro-ws] error (phase=${phase}, 细节不透明，见下方 close code 与 Network 握手状态)`);
```

close listener 使用：

```ts
const diagnostic = buildTrainV2CloseDiagnostic(close, opened ? 'connected' : 'handshake');
console[diagnostic.level](diagnostic.message);
```

从文件末尾导出 helper 和相关类型供测试使用。

- [ ] **Step 4: 验证 trainV2 与 Side Panel 回归**

```bash
node --experimental-strip-types --test pages/side-panel/src/services/ws/train-v2-client.test.mjs pages/side-panel/src/services/ws/train-v2-page-relay.test.mjs
pnpm -F @extension/sidepanel lint
pnpm -F @extension/sidepanel type-check
```

Expected: 全部 PASS；异常 `1006/4xxx` 仍是 warning。

- [ ] **Step 5: 提交 Task 5**

```bash
git add pages/side-panel/src/services/ws/train-v2-client.ts pages/side-panel/src/services/ws/train-v2-client.test.mjs
git commit -m "fix(side-panel): reduce Pro websocket close noise"
```

---

### Task 6: 全量验证与 yichi Chrome 真实回归

**Files:**
- Verify only: all files touched by Tasks 1-5
- Do not modify: `.playwright-mcp/`, `.qoder/`, `docs/ability-training-pro-api.md`, generated `dist/`

**Interfaces:**
- Consumes: 五个已审核提交。
- Produces: 可加载的 `dist/` 与真实回归证据；不部署 Admin Web、不推送远端。

- [ ] **Step 1: 运行所有新增与相关 Node 测试**

Run from repository root:

```bash
node --experimental-strip-types --test pages/side-panel/src/services/pro-conversation.test.mjs pages/side-panel/src/services/pro-training-context-service.test.mjs pages/side-panel/src/services/history-log-format.test.mjs pages/side-panel/src/services/pro-stage-start-target.test.mjs pages/side-panel/src/hooks/useProAgentChat.stage-jump.test.mjs pages/side-panel/src/hooks/useProAgentChat.user-refresh.test.mjs pages/side-panel/src/SidePanel.pro-debug.test.mjs pages/side-panel/src/services/ws/train-v2-client.test.mjs pages/side-panel/src/services/ws/train-v2-page-relay.test.mjs
```

Expected: 全部 PASS，输出无未处理 rejection。

- [ ] **Step 2: 运行扩展 scoped 静态检查**

```bash
pnpm -F @extension/storage lint
pnpm -F @extension/storage type-check
pnpm -F @extension/sidepanel lint
pnpm -F @extension/sidepanel type-check
```

Expected: 全部 exit 0。

- [ ] **Step 3: 运行 Admin Web 测试、检查和构建**

Run from `admin_web/`:

```bash
pnpm exec tsx src/lib/agent-log-schema.test.ts
pnpm exec tsx src/components/settings/history/extension-history-utils.test.ts
pnpm check
pnpm build
```

Expected: 全部 exit 0；不生成 migration，不部署。

- [ ] **Step 4: 运行根生产构建**

Run from repository root:

```bash
pnpm build
git diff --check
git status --short
```

Expected: build 成功；`git diff --check` 无输出；status 仅保留用户原有未跟踪文件。

- [ ] **Step 5: 在 yichi Chrome 回归普通 Pro 启动**

1. 在 `chrome://extensions/` Reload 当前 workspace 的 `dist/`。
2. 刷新 yichi Chrome 的能力训练 Pro 页面。
3. 使用默认开始，完成至少一个学生回合。
4. 确认当前 bundle 没有新的异常 `1006`；主动停止不再出现在扩展错误页。

Expected: trainV2 握手 `101`，普通 Pro 路径与本次改动前一致。

- [ ] **Step 6: 回归目标阶段跳转和历史昵称**

1. 在 Pro 运行中打开「调试模式」。
2. 选择第二个阶段。
3. 确认旧聊天被清空、旧历史仍存在、新历史 session 被创建。
4. 确认系统消息显示目标阶段，目标阶段角色开始发言并完成至少一个学生回合。
5. 打开扩展历史，确认角色显示 `nickname:`，没有 `AI: nickname:`；用户仍显示 `用户:`。
6. 下载 TXT，做同样断言。
7. 切换普通文字训练做一次调试跳转，确认仍走 RunCard。

Expected: 目标阶段只替换第一次 `nextStep`，后续阶段正常；旧 socket 的迟到事件不进入新聊天。

- [ ] **Step 7: 检查提交与工作区边界**

```bash
git log --oneline -6
git status --short
```

Expected: 包含本计划五个任务提交；未修改用户原有未跟踪文件；不提交 `dist/`。
