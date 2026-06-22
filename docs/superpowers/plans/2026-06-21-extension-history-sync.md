# 插件历史记录云端同步（v2）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让登录用户的训练历史（`agent-log-storage`）云端化——插件后台自动上传、Admin Web 只读查看、登录跨设备自动合并拉取，并按用户隔离、用 tombstone 防删除复活。

**Architecture:** 复刻 v1（登录 + 配置同步）的双通道范式——扩展跨域走 background `ADMIN_WEB_REQUEST` + bearer，网页走 cookie 服务函数。新增独立的 D1 表 `userAgentLog`（每 session 一行 + `deletedAt` 软删）、bearer route `/api/extension/history`（GET/POST/DELETE）、只读网页查看页，以及插件侧同步引擎 `useHistorySync`。每 session 以 `max(updatedAt, deletedAt)` 做 last-write-wins，不做冲突合并。

**Tech Stack:** Chrome MV3 扩展（pnpm monorepo，TS + React，`@extension/*`）；Admin Web（TanStack Start + Cloudflare Workers + D1 + Drizzle + Better Auth bearer，`@/`）；Zod 校验。

**Spec:** `docs/superpowers/specs/2026-06-21-extension-history-sync-design.md`（已折入一轮 Codex 对抗评审 + advisor 收紧）。

## Global Constraints

每个任务的需求都隐含包含本节。逐字遵守。

- **基线分支**：v1 已经 PR #5 合并进 `main`，当前 HEAD 在 `main`。实现在新分支 `feat/extension-history-sync` 上进行（由执行技能/worktree 在执行时创建）。
- **无单元测试运行器**：扩展侧与 admin_web 均无单测框架。门禁 = type-check / lint / build + spec §9 的人工冒烟。不要新增测试运行器，不要写无法运行的「失败测试」步骤。
- **admin_web 格式化以 prettier 为准**（v1 决策）：门禁 = `cd admin_web && pnpm exec tsc --noEmit`；`pnpm check`（biome 只读）的折行类告警**非阻塞**。admin_web 用 `function` 声明 + `@/` 别名是其本地约定（非违规）。
- **扩展侧严格 ESLint**（packages/* · pages/* · chrome-extension）：箭头函数表达式（非 function 声明）、exports 放文件末尾、可点击非交互 JSX 需 role/tabIndex/键盘支持/可访问标签、未用 catch 变量写 `catch {}`。门禁 = type-check / lint / build。
- **提交纪律**：每个任务只 `git add` 本任务列出的文件；绝不 `git add -A`；绝不提交无关文件。Conventional Commits。
- **不可触碰**：polymas 路径（`API_REQUEST`、`ai-poly` cookie、`cloudapi.polymas.com`）；生成的 `manifest.json`（只改 `chrome-extension/manifest.ts`，本期不需要改 manifest）；`src/routeTree.gen.ts`（自动生成）。
- **跨工作区导入**：扩展用 `@extension/*`，不要深相对路径跨包；admin_web 用 `@/`。
- **数据主权与归属**：服务端**只按 bearer token 的 userId 归属**（D1 `userId` 列），绝不信客户端传来的 `ownerUserId`；`ownerUserId` 是纯本地过滤字段，上传剥离、下载按当前用户重盖。
- **dev 占位（既有发布门禁，本期不填生产值）**：`ADMIN_WEB_BASE_URL='http://localhost:3000'`（`chrome-extension/src/background/index.ts`）；`trustedOrigins=['chrome-extension://*']`（`admin_web/src/auth/auth.ts`）。上线前另行收紧，不在本计划范围。
- **LWW 规则**：active 行仅当传入 `updatedAt >=` 现有才覆盖；tombstone 行仅当传入 `updatedAt > deletedAt` 才复活。合并端以 `max(updatedAt, deletedAt)` 判每个 session 的最终状态。
- **数据契约（wire JSON，两侧各自定义类型，靠 JSON 对齐）**：
  - `AgentLogSession`：`{ id, taskId, taskName?, createdAt, updatedAt, stepNameMapping?, entries[], ownerUserId? }`（`ownerUserId` 仅本地，不上传/不入库）。
  - `AgentLogEntry`（=ChatLogEntry）：`{ type:'chat', timestamp, stepId, stepName?, round, source:'runCard'|'chat', userText?, aiText? }`。
  - `Tombstone`：`{ sessionId: string, deletedAt: number }`。
  - 接口：`GET /api/extension/history → 200 {sessions, tombstones} | 401`；`POST {sessions} → 200 {ok:true} | 400 | 401`；`DELETE {sessionIds} → 200 {ok:true} | 401`；均需 `Authorization: Bearer`。

---

## 文件结构

**Admin Web（`admin_web/`）**
| 文件 | 责任 |
|------|------|
| `src/db/app.schema.ts`（改） | 新增 `userAgentLog` 表 + relation |
| `src/db/types.ts`（改） | 新增 `UserAgentLog` 推导类型 |
| `src/db/migrations/00XX_*.sql`（生成） | `db:generate` 产物 |
| `src/lib/agent-log-schema.ts`（建） | zod 镜像 `AgentLogSession`（不含 ownerUserId）+ `Tombstone` 类型 |
| `src/api/extension-history.ts`（建） | `readUserHistory/upsertUserHistory/deleteUserHistory` + `getMyHistory` 服务函数 |
| `src/routes/api/extension/history.ts`（建） | bearer GET/POST/DELETE route |
| `src/components/settings/history/extension-history-view.tsx`（建） | 只读历史查看组件（列表+详情+下载 TXT） |
| `src/routes/settings/history.tsx`（建） | 挂载查看组件的路由 |

**扩展**
| 文件 | 责任 |
|------|------|
| `packages/storage/lib/impl/agent-log-storage.ts`（改） | `AgentLogSession` 加 `ownerUserId?`；`createSession` 盖章；导出纯函数 `selectVisibleSessions` |
| `chrome-extension/src/background/index.ts`（改） | `AdminWebRequestPayload.method` 加 `'DELETE'` |
| `pages/side-panel/src/services/background-bridge.ts`（改） | 同上（bridge 侧类型） |
| `pages/side-panel/src/services/admin-web-service.ts`（改） | `fetchHistory/pushHistory/deleteHistory` |
| `pages/side-panel/src/hooks/useHistorySync.ts`（建） | 同步引擎：登录合并 + 实时对账 + 反馈回路防护 + 匿名迁移 |
| `pages/side-panel/src/components/HistoryModal.tsx`（改） | owner 感知过滤 + `currentUserId` prop |
| `pages/side-panel/src/SidePanel.tsx`（改） | 挂载 `useHistorySync`、向 HistoryModal 传 `currentUserId` |
| `pages/side-panel/AGENTS.md`（改） | 文档：历史同步（v2） |

---

## Task 1: D1 表 `userAgentLog` + 类型 + 迁移

**Files:**
- Modify: `admin_web/src/db/app.schema.ts`（在文件末尾 `userLlmConfig` 之后追加）
- Modify: `admin_web/src/db/types.ts`
- Create（生成）: `admin_web/src/db/migrations/00XX_*.sql`

**Interfaces:**
- Produces: 表 `userAgentLog`，列 `id, userId, sessionId, session(nullable), updatedAt, deletedAt(nullable), createdAt`；唯一索引 `(userId, sessionId)`；类型 `UserAgentLog`。

- [ ] **Step 1: 扩展 import，新增表与 relation**

`admin_web/src/db/app.schema.ts` 顶部 import 增加 `uniqueIndex`：
```ts
import { integer, sqliteTable, text, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
```
在文件末尾（`userLlmConfigRelations` 之后）追加：
```ts
/**
 * 扩展训练历史：每个用户的每条 session 一行；session 列存整份 AgentLogSession 的 JSON。
 * deletedAt 非空即 tombstone（软删，防跨设备删除复活）；tombstone 行 session 置空省空间。
 */
export const userAgentLog = sqliteTable(
  'user_agent_log',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    sessionId: text('session_id').notNull(),
    session: text('session'),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  table => [
    uniqueIndex('user_agent_log_user_session_idx').on(table.userId, table.sessionId),
    index('user_agent_log_user_id_idx').on(table.userId),
  ],
);

export const userAgentLogRelations = relations(userAgentLog, ({ one }) => ({
  user: one(user, {
    fields: [userAgentLog.userId],
    references: [user.id],
  }),
}));
```

- [ ] **Step 2: 新增推导类型**

`admin_web/src/db/types.ts`：
```ts
import { apikey, user } from './auth.schema';
import { userFiles, payment, userLlmConfig, userAgentLog } from './app.schema';

export type User = typeof user.$inferSelect;
export type ApiKey = typeof apikey.$inferSelect;
export type UserFiles = typeof userFiles.$inferSelect;
export type Payment = typeof payment.$inferSelect;
export type UserLlmConfig = typeof userLlmConfig.$inferSelect;
export type UserAgentLog = typeof userAgentLog.$inferSelect;
```

- [ ] **Step 3: 生成迁移**

Run: `cd admin_web && pnpm db:generate`
Expected: 在 `admin_web/src/db/migrations/` 生成一个新的 `00XX_*.sql`，内含 `CREATE TABLE \`user_agent_log\``、`CREATE UNIQUE INDEX \`user_agent_log_user_session_idx\``、`CREATE INDEX \`user_agent_log_user_id_idx\``。

- [ ] **Step 4: 应用到本地 D1**

Run: `cd admin_web && pnpm db:migrate:local`
Expected: 迁移成功（无报错）。`:remote` 留人工/发布前。

- [ ] **Step 5: 类型门禁**

Run: `cd admin_web && pnpm exec tsc --noEmit`
Expected: 通过（无类型错误）。

- [ ] **Step 6: Commit**

```bash
git add admin_web/src/db/app.schema.ts admin_web/src/db/types.ts admin_web/src/db/migrations
git commit -m "feat(admin_web): 新增 userAgentLog 表(软删 tombstone)与迁移"
```

---

## Task 2: zod 镜像 `agent-log-schema.ts`

**Files:**
- Create: `admin_web/src/lib/agent-log-schema.ts`

**Interfaces:**
- Produces: `agentLogSessionSchema`（zod，不含 ownerUserId），`AgentLogSessionInput = z.infer<...>`，`interface Tombstone { sessionId: string; deletedAt: number }`。

- [ ] **Step 1: 写 schema 文件**

`admin_web/src/lib/agent-log-schema.ts`：
```ts
import { z } from 'zod';

/** 单条对话日志条目（与扩展 agent-log-storage 的 ChatLogEntry 对应） */
const chatLogEntrySchema = z.object({
  type: z.literal('chat'),
  timestamp: z.number(),
  stepId: z.string(),
  stepName: z.string().optional(),
  round: z.number(),
  source: z.enum(['runCard', 'chat']),
  userText: z.string().optional(),
  aiText: z.string().optional(),
});

/**
 * 扩展 AgentLogSession 的服务端镜像（与
 * packages/storage/lib/impl/agent-log-storage.ts 的 AgentLogSession 对应）。
 * 注意：不含 ownerUserId——归属由服务端按 bearer token 决定，不持久化客户端字段。
 * z.object 默认剥离未知键，故客户端误带 ownerUserId 也会被去除。
 */
export const agentLogSessionSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  taskName: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  stepNameMapping: z.record(z.string(), z.string()).optional(),
  entries: z.array(chatLogEntrySchema),
});

export type AgentLogSessionInput = z.infer<typeof agentLogSessionSchema>;

export interface Tombstone {
  sessionId: string;
  deletedAt: number;
}
```

- [ ] **Step 2: 类型门禁**

Run: `cd admin_web && pnpm exec tsc --noEmit`
Expected: 通过。若 `z.record(z.string(), z.string())` 报参数数量错误（旧版 zod），改为 `z.record(z.string())`。

- [ ] **Step 3: Commit**

```bash
git add admin_web/src/lib/agent-log-schema.ts
git commit -m "feat(admin_web): 新增 AgentLogSession 的 zod 镜像与 Tombstone 类型"
```

---

## Task 3: 数据访问 + 服务函数 `extension-history.ts`

**Files:**
- Create: `admin_web/src/api/extension-history.ts`

**Interfaces:**
- Consumes: `userAgentLog`（Task 1）；`agentLogSessionSchema / AgentLogSessionInput / Tombstone`（Task 2）；`authApiMiddleware`（既有）。
- Produces:
  - `readUserHistory(userId): Promise<{ sessions: AgentLogSessionInput[]; tombstones: Tombstone[] }>`
  - `upsertUserHistory(userId, sessions: AgentLogSessionInput[]): Promise<void>`（LWW + tombstone 复活守卫）
  - `deleteUserHistory(userId, sessionIds: string[]): Promise<void>`（软删）
  - `getMyHistory` 服务函数（只读 active）

- [ ] **Step 1: 写数据访问层**

`admin_web/src/api/extension-history.ts`：
```ts
import { userAgentLog } from '@/db/app.schema';
import {
  agentLogSessionSchema,
  type AgentLogSessionInput,
  type Tombstone,
} from '@/lib/agent-log-schema';
import { authApiMiddleware } from '@/middlewares/auth-middleware';
import { createServerFn } from '@tanstack/react-start';
import { and, eq } from 'drizzle-orm';

/** 读取某用户的历史：active 行回 session，tombstone 行回 {sessionId, deletedAt}。 */
export async function readUserHistory(
  userId: string,
): Promise<{ sessions: AgentLogSessionInput[]; tombstones: Tombstone[] }> {
  const { getDb } = await import('@/db');
  const db = getDb();
  const rows = await db
    .select()
    .from(userAgentLog)
    .where(eq(userAgentLog.userId, userId));

  const sessions: AgentLogSessionInput[] = [];
  const tombstones: Tombstone[] = [];
  for (const row of rows) {
    if (row.deletedAt) {
      tombstones.push({ sessionId: row.sessionId, deletedAt: row.deletedAt.getTime() });
    } else if (row.session) {
      // 容错：库里坏数据时跳过该条而非整体抛错。
      const parsed = agentLogSessionSchema.safeParse(JSON.parse(row.session));
      if (parsed.success) {
        sessions.push(parsed.data);
      }
    }
  }
  return { sessions, tombstones };
}

/**
 * upsert 某用户的历史（按 (userId, sessionId)）。
 * LWW：active 行仅当传入 updatedAt >= 现有才覆盖；
 * tombstone 行仅当传入 updatedAt > deletedAt 才复活（清 deletedAt），否则保持 tombstone。
 */
export async function upsertUserHistory(
  userId: string,
  sessions: AgentLogSessionInput[],
): Promise<void> {
  const { getDb } = await import('@/db');
  const db = getDb();
  const now = new Date();

  for (const session of sessions) {
    const incoming = session.updatedAt;
    const [existing] = await db
      .select({ updatedAt: userAgentLog.updatedAt, deletedAt: userAgentLog.deletedAt })
      .from(userAgentLog)
      .where(and(eq(userAgentLog.userId, userId), eq(userAgentLog.sessionId, session.id)))
      .limit(1);

    if (existing) {
      const existingDeleted = existing.deletedAt ? existing.deletedAt.getTime() : null;
      if (existingDeleted !== null) {
        if (incoming <= existingDeleted) {
          continue; // tombstone 胜，忽略陈旧/等时间戳上传，防复活
        }
      } else if (incoming < existing.updatedAt.getTime()) {
        continue; // 旧值，忽略
      }
      await db
        .update(userAgentLog)
        .set({ session: JSON.stringify(session), updatedAt: new Date(incoming), deletedAt: null })
        .where(and(eq(userAgentLog.userId, userId), eq(userAgentLog.sessionId, session.id)));
    } else {
      await db.insert(userAgentLog).values({
        id: crypto.randomUUID(),
        userId,
        sessionId: session.id,
        session: JSON.stringify(session),
        updatedAt: new Date(incoming),
        deletedAt: null,
        createdAt: now,
      });
    }
  }
}

/** 软删：置 deletedAt、清 session 体；云端不存在的 sessionId 影响 0 行（无害）。 */
export async function deleteUserHistory(userId: string, sessionIds: string[]): Promise<void> {
  if (sessionIds.length === 0) {
    return;
  }
  const { getDb } = await import('@/db');
  const db = getDb();
  const now = new Date();
  for (const sessionId of sessionIds) {
    await db
      .update(userAgentLog)
      .set({ deletedAt: now, session: null })
      .where(and(eq(userAgentLog.userId, userId), eq(userAgentLog.sessionId, sessionId)));
  }
}

/** 网页只读查看：返回本人 active 历史（不含 tombstone）。 */
export const getMyHistory = createServerFn({ method: 'GET' })
  .middleware([authApiMiddleware])
  .handler(async ({ context }) => {
    const { sessions } = await readUserHistory(context.userId);
    return { sessions };
  });
```

- [ ] **Step 2: 类型门禁**

Run: `cd admin_web && pnpm exec tsc --noEmit`
Expected: 通过。（`and` 来自 `drizzle-orm`；`getDb` 动态导入与 v1 `extension-config.ts` 一致。）

- [ ] **Step 3: Commit**

```bash
git add admin_web/src/api/extension-history.ts
git commit -m "feat(admin_web): 历史数据访问层(LWW+tombstone守卫)与 getMyHistory"
```

---

## Task 4: bearer route `/api/extension/history`

**Files:**
- Create: `admin_web/src/routes/api/extension/history.ts`

**Interfaces:**
- Consumes: `readUserHistory/upsertUserHistory/deleteUserHistory`（Task 3）；`agentLogSessionSchema`（Task 2）。
- Produces: HTTP route `/api/extension/history`，GET/POST/DELETE，bearer 鉴权（含 emailVerified），401/400。

- [ ] **Step 1: 写 route 文件**

`admin_web/src/routes/api/extension/history.ts`（`requireUserId`/`jsonResponse` 刻意镜像 v1 `config.ts`，保持一致）：
```ts
import { createFileRoute } from '@tanstack/react-router';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { z } from 'zod';
import {
  readUserHistory,
  upsertUserHistory,
  deleteUserHistory,
} from '@/api/extension-history';
import { agentLogSessionSchema } from '@/lib/agent-log-schema';

const jsonResponse = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const requireUserId = async (): Promise<string | null> => {
  const headers = getRequestHeaders();
  const { auth } = await import('@/auth/auth');
  const session = await auth.api.getSession({ headers });
  if (!session?.user || !session.user.emailVerified) {
    return null;
  }
  return session.user.id;
};

const postBodySchema = z.object({ sessions: z.array(agentLogSessionSchema) });
const deleteBodySchema = z.object({ sessionIds: z.array(z.string()) });

export const Route = createFileRoute('/api/extension/history')({
  server: {
    handlers: {
      GET: async () => {
        const userId = await requireUserId();
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }
        const data = await readUserHistory(userId);
        return jsonResponse(data);
      },
      POST: async ({ request }) => {
        const userId = await requireUserId();
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }
        const parsed = postBodySchema.safeParse(await request.json());
        if (!parsed.success) {
          return jsonResponse({ error: 'Invalid history' }, 400);
        }
        await upsertUserHistory(userId, parsed.data.sessions);
        return jsonResponse({ ok: true });
      },
      DELETE: async ({ request }) => {
        const userId = await requireUserId();
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }
        const parsed = deleteBodySchema.safeParse(await request.json());
        if (!parsed.success) {
          return jsonResponse({ error: 'Invalid sessionIds' }, 400);
        }
        await deleteUserHistory(userId, parsed.data.sessionIds);
        return jsonResponse({ ok: true });
      },
    },
  },
});
```

- [ ] **Step 2: 类型门禁**

Run: `cd admin_web && pnpm exec tsc --noEmit`
Expected: 通过。`src/routeTree.gen.ts` 会在 dev/build 时自动登记 `/api/extension/history`（勿手改）。

- [ ] **Step 3: 实测 401 门禁（无 token）**

启动 dev（若未运行）：`cd admin_web && pnpm dev`（端口 3000）。另开终端：
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/extension/history
```
Expected: `401`。
（happy-path GET/POST/DELETE 带合法 bearer 的闭环留人工清单——需已验证邮箱的用户登录取 token。）

- [ ] **Step 4: Commit**

```bash
git add admin_web/src/routes/api/extension/history.ts admin_web/src/routeTree.gen.ts
git commit -m "feat(admin_web): 新增 /api/extension/history bearer 路由(GET/POST/DELETE)"
```
（起 dev 跑 curl 会把 `/api/extension/history` 写入自动生成的 `routeTree.gen.ts`，一并提交；勿手改该文件。）

---

## Task 5: 网页只读历史查看页

**Files:**
- Create: `admin_web/src/components/settings/history/extension-history-view.tsx`
- Create: `admin_web/src/routes/settings/history.tsx`

**Interfaces:**
- Consumes: `getMyHistory`（Task 3）；`AgentLogSessionInput`（Task 2）；`DashboardLayout`（既有，见 v1 `settings/extension.tsx`）。
- Produces: 路由 `/settings/history`（只读列表+详情+下载 TXT）。

- [ ] **Step 1: 写查看组件**

`admin_web/src/components/settings/history/extension-history-view.tsx`：
```tsx
import { useEffect, useState } from 'react';
import { getMyHistory } from '@/api/extension-history';
import type { AgentLogSessionInput } from '@/lib/agent-log-schema';

const formatTime = (ms: number) => new Date(ms).toLocaleString('zh-CN');

const getSessionName = (s: AgentLogSessionInput) => s.taskName?.trim() || s.taskId || s.id;

const getStepName = (s: AgentLogSessionInput, entry: AgentLogSessionInput['entries'][number]) =>
  entry.stepName || s.stepNameMapping?.[entry.stepId] || entry.stepId || '未知步骤';

// 与扩展 HistoryModal.buildLogText 对齐的下载文本格式。
function buildLogText(s: AgentLogSessionInput): string {
  const lines: string[] = [
    '对话记录',
    `日志创建时间: ${formatTime(s.createdAt)}`,
    `任务名称: ${getSessionName(s)}`,
    `task_id: ${s.taskId}`,
    '='.repeat(60),
  ];
  for (const entry of s.entries) {
    const roundInfo = entry.round ? ` | 第 ${entry.round} 轮` : '';
    lines.push(`Step: ${getStepName(s, entry)} | step_id: ${entry.stepId}${roundInfo} | 来源: ${entry.source}`);
    if (entry.userText) {
      lines.push(`用户: ${entry.userText}`);
    }
    if (entry.aiText) {
      lines.push(`AI: ${entry.aiText}`);
    }
    lines.push('-'.repeat(40));
  }
  return lines.join('\n');
}

function downloadLogText(s: AgentLogSessionInput) {
  const blob = new Blob([buildLogText(s)], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${getSessionName(s).replace(/[\\/:*?"<>|]/g, '_')}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

export function ExtensionHistoryView() {
  const [loaded, setLoaded] = useState(false);
  const [sessions, setSessions] = useState<AgentLogSessionInput[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    getMyHistory().then(({ sessions: rows }) => {
      const sorted = [...rows].sort((a, b) => b.updatedAt - a.updatedAt);
      setSessions(sorted);
      setActiveId(sorted[0]?.id ?? null);
      setLoaded(true);
    });
  }, []);

  if (!loaded) {
    return <p className="text-muted-foreground text-sm">加载中…</p>;
  }
  if (sessions.length === 0) {
    return <p className="text-muted-foreground text-sm">暂无历史记录。</p>;
  }

  const active = sessions.find(s => s.id === activeId) ?? null;

  return (
    <div className="flex max-w-4xl gap-4">
      <ul className="w-64 shrink-0 space-y-1">
        {sessions.map(s => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => setActiveId(s.id)}
              className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                activeId === s.id ? 'border-primary bg-muted' : 'border-border'
              }`}>
              <div className="font-medium">{getSessionName(s)}</div>
              <div className="text-muted-foreground text-xs">{formatTime(s.updatedAt)}</div>
              <div className="text-muted-foreground text-xs">记录数: {s.entries.length}</div>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex-1 rounded-md border p-4">
        {active ? (
          <>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium">{getSessionName(active)}</span>
              <button
                type="button"
                onClick={() => downloadLogText(active)}
                className="rounded-md border px-3 py-1 text-sm">
                下载 TXT
              </button>
            </div>
            <div className="space-y-3 text-sm">
              {active.entries.map((entry, i) => (
                <div key={`${entry.timestamp}_${i}`} className="rounded-md bg-muted p-2">
                  <div className="text-muted-foreground text-xs">
                    {getStepName(active, entry)} · {entry.source}
                  </div>
                  {entry.userText ? <p className="mt-1 whitespace-pre-wrap">用户: {entry.userText}</p> : null}
                  {entry.aiText ? <p className="mt-1 whitespace-pre-wrap">AI: {entry.aiText}</p> : null}
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">请选择左侧一条记录查看。</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 写路由**

`admin_web/src/routes/settings/history.tsx`（镜像 v1 `settings/extension.tsx`）：
```tsx
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ExtensionHistoryView } from '@/components/settings/history/extension-history-view';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/history')({
  component: ExtensionHistoryPage,
});

function ExtensionHistoryPage() {
  const breadcrumbs = [
    { label: '设置', isCurrentPage: false },
    { label: '插件历史', isCurrentPage: true },
  ];
  return (
    <DashboardLayout
      breadcrumbs={breadcrumbs}
      title="插件历史"
      description="查看插件上传的训练对话历史（只读）。">
      <ExtensionHistoryView />
    </DashboardLayout>
  );
}
```

- [ ] **Step 3: 类型 + 构建门禁**

Run: `cd admin_web && pnpm exec tsc --noEmit`
Expected: 通过（`/settings/history` 被 routeTree 登记；若 dev watcher 报瞬时未登记错误，重跑一次 tsc 即可）。

Run: `cd admin_web && pnpm build`
Expected: 构建成功。

- [ ] **Step 4: Commit**

```bash
git add admin_web/src/components/settings/history/extension-history-view.tsx admin_web/src/routes/settings/history.tsx admin_web/src/routeTree.gen.ts
git commit -m "feat(admin_web): 新增 /settings/history 只读历史查看页"
```

---

## Task 6: 扩展存储 `agent-log-storage` — ownerUserId + 选择器

**Files:**
- Modify: `packages/storage/lib/impl/agent-log-storage.ts`

**Interfaces:**
- Consumes: `authSessionStorage`（同包 `./auth-session-storage.js`）。
- Produces: `AgentLogSession` 新增 `ownerUserId?: string`；`createSession` 在登录态盖 `ownerUserId`；导出纯函数 `selectVisibleSessions(sessions, currentUserId): AgentLogSession[]`。

- [ ] **Step 1: AgentLogSession 加 ownerUserId**

`packages/storage/lib/impl/agent-log-storage.ts` 的 `AgentLogSession` 接口加字段：
```ts
interface AgentLogSession {
  id: string;
  taskId: string;
  taskName?: string;
  createdAt: number;
  updatedAt: number;
  stepNameMapping?: Record<string, string>;
  entries: AgentLogEntry[];
  ownerUserId?: string; // 纯本地过滤字段；上传剥离、下载按当前用户重盖
}
```

- [ ] **Step 2: import authSessionStorage，createSession 盖章**

文件顶部 import 增加（同 impl 目录，无循环依赖：auth-session-storage 只依赖 base）：
```ts
import { authSessionStorage } from './auth-session-storage.js';
```
把 `createSession` 改为读取登录态后盖 `ownerUserId`：
```ts
  createSession: async ({ taskId, taskName, stepNameMapping }) => {
    const now = Date.now();
    const auth = await authSessionStorage.get();
    const session: AgentLogSession = {
      id: generateSessionId(),
      taskId,
      taskName,
      createdAt: now,
      updatedAt: now,
      stepNameMapping,
      entries: [],
      ...(auth.isLoggedIn && auth.user ? { ownerUserId: auth.user.id } : {}),
    };

    await storage.set(current => [...current, session]);
    return session;
  },
```

- [ ] **Step 3: 新增纯函数选择器 selectVisibleSessions**

在 `agentLogStorage` 对象定义之后、`export` 之前加：
```ts
/**
 * 按当前登录用户过滤可见 session：
 * - 登录态：显示本人(ownerUserId===currentUserId) + 匿名(未设 ownerUserId，待迁移)；
 * - 登出态：仅显示匿名。
 * 同一 Chrome profile 下不显示其他用户的历史（用户隔离）。
 */
const selectVisibleSessions = (
  sessions: AgentLogSession[],
  currentUserId: string | null,
): AgentLogSession[] => {
  if (currentUserId) {
    return sessions.filter(s => s.ownerUserId === currentUserId || s.ownerUserId === undefined);
  }
  return sessions.filter(s => s.ownerUserId === undefined);
};
```

- [ ] **Step 4: 导出选择器**

把文件末尾导出改为：
```ts
export { agentLogStorage, selectVisibleSessions };
export type { AgentLogEntryType, AgentLogSource, ChatLogEntry, AgentLogEntry, AgentLogSession, AgentLogStorageType };
```
（`selectVisibleSessions` 经 `packages/storage/lib/impl/index.ts` 的 `export * from './agent-log-storage.js'` 自动透出，无需改 index。）

- [ ] **Step 5: 门禁**

Run: `pnpm -F @extension/storage type-check`
Expected: 通过。

Run: `pnpm -F @extension/storage lint`
Expected: 通过。

- [ ] **Step 6: Commit**

```bash
git add packages/storage/lib/impl/agent-log-storage.ts
git commit -m "feat(storage): agent-log 加 ownerUserId 盖章与 selectVisibleSessions 选择器"
```

---

## Task 7: background + bridge 支持 DELETE

**Files:**
- Modify: `chrome-extension/src/background/index.ts:36`
- Modify: `pages/side-panel/src/services/background-bridge.ts:93`

**Interfaces:**
- Produces: `AdminWebRequestPayload.method` 类型扩为 `'GET' | 'POST' | 'DELETE'`（两处定义一致）；handler 已透传任意 method + body（无需改逻辑）。

- [ ] **Step 1: 改 background 侧类型**

`chrome-extension/src/background/index.ts` 的 `AdminWebRequestPayload`：
```ts
interface AdminWebRequestPayload {
  path: string;
  method: 'GET' | 'POST' | 'DELETE';
  body?: Record<string, unknown>;
  auth?: boolean;
}
```
（`handleAdminWebRequest` 已用 `fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined })`，DELETE 带 body 在 fetch 下可行，逻辑无需改。）

- [ ] **Step 2: 改 bridge 侧类型**

`pages/side-panel/src/services/background-bridge.ts` 的 `AdminWebRequestPayload`：
```ts
interface AdminWebRequestPayload {
  path: string;
  method: 'GET' | 'POST' | 'DELETE';
  body?: Record<string, unknown>;
  auth?: boolean;
}
```

- [ ] **Step 3: 门禁**

Run: `pnpm -F @extension/sidepanel type-check`
Expected: 通过。

Run: `pnpm -F chrome-extension type-check`
Expected: 通过。（若该 workspace 名不同，用 `pnpm type-check` 全量。）

- [ ] **Step 4: DELETE 透传人工冒烟（留人工清单，但记录命令）**

dev 起 admin_web 后，验证扩展 background 能发出 DELETE（在 happy-path 闭环里覆盖；本步仅类型 + 代码审查确认 method 透传，运行期 DELETE 验证并入人工清单）。
退路（若实现期发现 DELETE+body 在某运行时被拒）：改用 `POST { action: 'delete', sessionIds }`，并相应改 Task 3/4/8——此为应急，默认走 DELETE。

- [ ] **Step 5: Commit**

```bash
git add chrome-extension/src/background/index.ts pages/side-panel/src/services/background-bridge.ts
git commit -m "feat(background): ADMIN_WEB_REQUEST 支持 DELETE method"
```

---

## Task 8: `admin-web-service` 历史收发

**Files:**
- Modify: `pages/side-panel/src/services/admin-web-service.ts`

**Interfaces:**
- Consumes: `adminWebRequest`（bridge）；`authSessionStorage`、`AgentLogSession`（`@extension/storage`）。
- Produces:
  - `fetchHistory(): Promise<{ ok: true; sessions: AgentLogSession[]; tombstones: Tombstone[] } | { ok: false }>`
  - `pushHistory(sessions: AgentLogSession[]): Promise<boolean>`（上传剥离 ownerUserId）
  - `deleteHistory(sessionIds: string[]): Promise<boolean>`
  - 导出 `interface Tombstone { sessionId: string; deletedAt: number }`

- [ ] **Step 1: 加类型与三个函数**

`pages/side-panel/src/services/admin-web-service.ts`：
- import 增加 `AgentLogSession`（与现有 type import 合并）：
```ts
import type { AuthUser, LLMConfig, AgentLogSession } from '@extension/storage';
```
- 在 `pushLlmConfig` 之后、`export` 之前追加：
```ts
interface Tombstone {
  sessionId: string;
  deletedAt: number;
}

type FetchHistoryResult =
  | { ok: true; sessions: AgentLogSession[]; tombstones: Tombstone[] }
  | { ok: false };

// 上传前剥离纯本地字段 ownerUserId（归属由服务端按 token 决定）。
const stripOwner = (s: AgentLogSession): AgentLogSession => {
  const copy = { ...s };
  delete copy.ownerUserId;
  return copy;
};

const fetchHistory = async (): Promise<FetchHistoryResult> => {
  const res = await adminWebRequest({ path: '/api/extension/history', method: 'GET', auth: true });
  if (!res.ok) {
    if (res.status === 401) {
      await authSessionStorage.clear();
    }
    return { ok: false };
  }
  const json = res.json as { sessions?: AgentLogSession[]; tombstones?: Tombstone[] };
  return { ok: true, sessions: json.sessions ?? [], tombstones: json.tombstones ?? [] };
};

const pushHistory = async (sessions: AgentLogSession[]): Promise<boolean> => {
  if (sessions.length === 0) {
    return true;
  }
  const res = await adminWebRequest({
    path: '/api/extension/history',
    method: 'POST',
    auth: true,
    body: { sessions: sessions.map(stripOwner) },
  });
  return res.ok;
};

const deleteHistory = async (sessionIds: string[]): Promise<boolean> => {
  if (sessionIds.length === 0) {
    return true;
  }
  const res = await adminWebRequest({
    path: '/api/extension/history',
    method: 'DELETE',
    auth: true,
    body: { sessionIds },
  });
  return res.ok;
};
```
- 更新导出行：
```ts
export { signUp, signIn, signOut, getSession, fetchLlmConfig, pushLlmConfig, fetchHistory, pushHistory, deleteHistory };
export type { AuthResult, Tombstone };
```

- [ ] **Step 2: 门禁**

Run: `pnpm -F @extension/sidepanel type-check`
Expected: 通过。（注：side-panel 既有 6 个与本特性无关的 type 错误——见 v1 ledger，packages/ui/* 与 useMultiRoleRun.ts；新增代码不得引入新错误。）

Run: `pnpm -F @extension/sidepanel lint`
Expected: 通过。

- [ ] **Step 3: Commit**

```bash
git add pages/side-panel/src/services/admin-web-service.ts
git commit -m "feat(side-panel): admin-web-service 新增历史收发(上传剥离 ownerUserId)"
```

---

## Task 9: 同步引擎 `useHistorySync`

**Files:**
- Create: `pages/side-panel/src/hooks/useHistorySync.ts`

**Interfaces:**
- Consumes: `fetchHistory/pushHistory/deleteHistory`（Task 8）；`agentLogStorage`、`AgentLogSession`（`@extension/storage`）。
- Produces: `useHistorySync(isLoggedIn: boolean, userId: string | null): void`。

**实现要点（spec §5.2，务必落实，否则出 bug）：**
- 登录合并 → 一次批量 `set` 落地；合并自身的 `set` 不能触发回灌/重删。
- `ready` 标志：合并完成前订阅回调一律忽略；合并结束时把内存快照设成「对账后状态」，使合并引发的 storage 事件 diff 为空。
- 只处理 `ownerUserId === userId` 的 session；其他用户/匿名不动。

- [ ] **Step 1: 写 hook**

`pages/side-panel/src/hooks/useHistorySync.ts`：
```ts
/**
 * 历史同步引擎：登录后把云端与本地历史按 max(updatedAt, deletedAt) 合并，
 * 并订阅本地变更做实时上传/软删传播。仅处理当前用户(ownerUserId===userId)的 session。
 */

import { fetchHistory, pushHistory, deleteHistory } from '../services/admin-web-service';
import { agentLogStorage } from '@extension/storage';
import { useEffect, useRef } from 'react';
import type { AgentLogSession } from '@extension/storage';

const DEBOUNCE_MS = 3000;

const useHistorySync = (isLoggedIn: boolean, userId: string | null): void => {
  const readyRef = useRef(false);
  const snapshotRef = useRef<Map<string, number>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isLoggedIn || !userId) {
      readyRef.current = false;
      snapshotRef.current = new Map();
      return;
    }

    let active = true;
    readyRef.current = false;
    snapshotRef.current = new Map();

    // (1) 登录后一次性合并（tombstone 感知）
    const mergeOnLogin = async () => {
      const result = await fetchHistory();
      if (!active) {
        return;
      }
      if (!result.ok) {
        // 拉取失败：不动本地、不进入对账（避免把本地误当独有上传）。
        return;
      }
      const cloud = new Map(result.sessions.map(s => [s.id, s]));
      const tomb = new Map(result.tombstones.map(t => [t.sessionId, t.deletedAt]));

      const local = await agentLogStorage.get();
      if (!active) {
        return;
      }
      const localOwned = new Map(
        local.filter(s => s.ownerUserId === userId).map(s => [s.id, s]),
      );

      const mergedOwned = new Map<string, AgentLogSession>();
      const toPush: AgentLogSession[] = [];
      const ids = new Set<string>([...cloud.keys(), ...localOwned.keys()]);
      for (const id of ids) {
        const c = cloud.get(id);
        const l = localOwned.get(id);
        const d = tomb.get(id);
        const cTime = c ? c.updatedAt : -Infinity;
        const lTime = l ? l.updatedAt : -Infinity;
        const dTime = d ?? -Infinity;
        const max = Math.max(cTime, lTime, dTime);
        if (d !== undefined && dTime === max) {
          continue; // tombstone 胜：不纳入本地、不回灌
        }
        if (c && cTime === max) {
          mergedOwned.set(id, { ...c, ownerUserId: userId }); // 云端胜：下载并重盖 owner
        } else if (l) {
          const owned = { ...l, ownerUserId: userId };
          mergedOwned.set(id, owned); // 本地胜/独有：保留并回灌
          toPush.push(owned);
        }
      }

      // 一次批量 set：保留非本用户(其它 owner + 匿名)项原样，替换本用户集。
      const others = local.filter(s => s.ownerUserId !== userId);
      await agentLogStorage.set([...others, ...mergedOwned.values()]);
      if (!active) {
        return;
      }

      // 快照 = 对账后状态；置 ready=true（在此之前订阅回调被忽略，故上面的 set 不会引发回灌）。
      const snap = new Map<string, number>();
      for (const s of mergedOwned.values()) {
        snap.set(s.id, s.updatedAt);
      }
      snapshotRef.current = snap;
      readyRef.current = true;

      if (toPush.length > 0) {
        await pushHistory(toPush);
      }
    };

    // (2) 实时对账（仅 ready 后）
    const reconcileChanges = async () => {
      if (!active || !readyRef.current) {
        return;
      }
      const all = await agentLogStorage.get();
      const owned = all.filter(s => s.ownerUserId === userId);
      const ownedIds = new Set(owned.map(s => s.id));

      const changed: AgentLogSession[] = [];
      for (const s of owned) {
        const prev = snapshotRef.current.get(s.id);
        if (prev === undefined || s.updatedAt > prev) {
          changed.push(s);
        }
      }
      const removed: string[] = [];
      for (const id of snapshotRef.current.keys()) {
        if (!ownedIds.has(id)) {
          removed.push(id);
        }
      }

      if (changed.length > 0 && (await pushHistory(changed))) {
        for (const s of changed) {
          snapshotRef.current.set(s.id, s.updatedAt);
        }
      }
      if (removed.length > 0 && (await deleteHistory(removed))) {
        for (const id of removed) {
          snapshotRef.current.delete(id);
        }
      }
    };

    const handleChange = () => {
      if (!readyRef.current) {
        return; // 合并阶段自身的 set 在此被忽略
      }
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        void reconcileChanges();
      }, DEBOUNCE_MS);
    };

    void mergeOnLogin();
    const unsubscribe = agentLogStorage.subscribe(handleChange);

    return () => {
      active = false;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      unsubscribe();
    };
  }, [isLoggedIn, userId]);
};

export { useHistorySync };
```

> 注（匿名迁移）：本任务先实现登录合并 + 实时对账。匿名历史（`ownerUserId` 未设）的「归入当前账号」一次性确认 UX 放在 Task 10 的 HistoryModal（轻量确认入口），确认后给这些 session 盖 `ownerUserId=userId` 并写回 `agentLogStorage`——届时实时对账会把它们当作「新增」自然上传，无需在本 hook 加专门分支。

- [ ] **Step 2: 门禁**

Run: `pnpm -F @extension/sidepanel type-check`
Expected: 通过（不引入新错误）。

Run: `pnpm -F @extension/sidepanel lint`
Expected: 通过（注意：箭头函数、exports-last）。

- [ ] **Step 3: Commit**

```bash
git add pages/side-panel/src/hooks/useHistorySync.ts
git commit -m "feat(side-panel): useHistorySync 同步引擎(登录合并+实时对账+反馈回路防护)"
```

---

## Task 10: HistoryModal owner 感知 + SidePanel 挂载 + 匿名迁移入口

**Files:**
- Modify: `pages/side-panel/src/components/HistoryModal.tsx`
- Modify: `pages/side-panel/src/SidePanel.tsx`

**Interfaces:**
- Consumes: `selectVisibleSessions`（Task 6）；`useHistorySync`（Task 9）；`agentLogStorage`。
- Produces: HistoryModal 增 `currentUserId: string | null` prop，按可见集渲染；SidePanel 挂载 `useHistorySync` 并传 `currentUserId`。

- [ ] **Step 1: HistoryModal 接受 currentUserId 并过滤**

`pages/side-panel/src/components/HistoryModal.tsx`：
- import 增加 `selectVisibleSessions`：
```ts
import { agentLogStorage, selectVisibleSessions } from '@extension/storage';
```
- props 接口加字段：
```ts
interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSessionId?: string;
  currentUserId: string | null;
}
```
- 解构 props：`const HistoryModal = ({ isOpen, onClose, initialSessionId, currentUserId }: HistoryModalProps) => {`
- 把数据加载 effect 内的两处 `await agentLogStorage.get()` 改为可见集（fetchSessions 内）：
```ts
    const fetchSessions = async () => {
      const data = selectVisibleSessions(await agentLogStorage.get(), currentUserId);
      if (isMounted) {
        setSessions(data);
      }
    };
```
- 该 effect 依赖数组加入 `currentUserId`：`}, [isOpen, currentUserId]);`

- [ ] **Step 2: HistoryModal 加「登出后历史收起」轻提示 + 匿名迁移入口**

在列表区顶部既有 amber 提示块之后，新增按登录态的轻提示（spec §5.3 有意设计）。在 `<div className="rounded-lg border border-amber-200 ...">...</div>` 之后插入：
```tsx
          {!currentUserId ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
              当前未登录，仅显示本机匿名历史。登录后将显示并同步你账号的历史。
            </div>
          ) : null}
```
匿名迁移入口（仅登录态且存在匿名 session 时显示一次性确认）：在上面提示之后插入：
```tsx
          {currentUserId && sessions.some(s => s.ownerUserId === undefined) ? (
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  const all = await agentLogStorage.get();
                  await agentLogStorage.set(
                    all.map(s => (s.ownerUserId === undefined ? { ...s, ownerUserId: currentUserId } : s)),
                  );
                })();
              }}
              className="rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-2 text-left text-xs text-cyan-700 transition-colors hover:border-cyan-300">
              检测到本机匿名历史，点此归入当前账号并同步到云端。
            </button>
          ) : null}
```
（盖 `ownerUserId` 后写回 `agentLogStorage` 会触发 `useHistorySync` 的实时对账，自然上传——无需额外调用。）

- [ ] **Step 3: SidePanel 挂载 hook 与传 prop**

`pages/side-panel/src/SidePanel.tsx`：
- import 增加：
```ts
import { useHistorySync } from './hooks/useHistorySync';
```
- 在 `const { isLoggedIn, session, login, register, logout } = useAdminWebAuth();`（约 1098 行）之后加：
```ts
  const currentUserId = session.user?.id ?? null;
  useHistorySync(isLoggedIn, currentUserId);
```
- HistoryModal 渲染处（约 1489 行）加 prop：
```tsx
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => {
          setIsHistoryOpen(false);
          setHistoryInitialSessionId(undefined);
        }}
        initialSessionId={historyInitialSessionId}
        currentUserId={currentUserId}
      />
```

- [ ] **Step 4: 门禁**

Run: `pnpm -F @extension/sidepanel type-check`
Expected: 通过（不引入新错误）。

Run: `pnpm -F @extension/sidepanel lint`
Expected: 通过（注意可点击 div/button 的 a11y：button 已带 type；新增交互用的是 `<button>`，满足键盘可达）。

Run: `pnpm build`
Expected: 构建成功。

- [ ] **Step 5: Commit**

```bash
git add pages/side-panel/src/components/HistoryModal.tsx pages/side-panel/src/SidePanel.tsx
git commit -m "feat(side-panel): HistoryModal owner 感知过滤 + 挂载 useHistorySync + 匿名迁移入口"
```

---

## Task 11: 文档 + 人工验证清单

**Files:**
- Modify: `pages/side-panel/AGENTS.md`

**Interfaces:** 无代码接口；收尾文档与回归清单。

- [ ] **Step 1: 在 `pages/side-panel/AGENTS.md` 增加历史同步段**

在 `## ADMIN WEB LOGIN & CONFIG SYNC (v1)` 段之后追加：
```markdown
## HISTORY SYNC (v2)
- 同步对象是 `agent-log-storage`（`HistoryModal` 展示的历史），不含 `agent-chat-storage`（当前对话缓冲）。
- `useHistorySync(isLoggedIn, userId)`（挂在 `SidePanel`）：登录后拉云端 `{sessions, tombstones}`，按 `max(updatedAt, deletedAt)` 与本地合并（一次批量 `set` 落地），再订阅 `agentLogStorage` 做 debounce 实时上传/软删传播。仅处理 `ownerUserId === userId` 的 session。
- **反馈回路防护**：合并阶段自身写 storage 会触发订阅；用 `ready` 标志（合并完成前忽略订阅）+ 合并后把内存快照设为对账后状态，避免把刚拉下来的又 POST 回去、把按 tombstone 删的又 DELETE 一遍。
- **用户隔离**：`AgentLogSession.ownerUserId` 是纯本地字段（上传剥离、下载重盖）；`selectVisibleSessions` 让 `HistoryModal` 登录看本人+匿名、登出仅看匿名。**登出后自己历史从 UI 收起是有意设计**（数据未删，再登录恢复）。服务端只按 bearer token 归属。
- **删除防复活**：删除走软删 tombstone（D1 `deletedAt`），合并端用 `max(updatedAt, deletedAt)` 判删，且服务端 upsert 仅当 `updatedAt > deletedAt` 才复活。
- 网页只读查看页：Admin Web `/settings/history`。
```

- [ ] **Step 2: docs 校验**

Run: `git diff --check`
Expected: 无空白错误。

- [ ] **Step 3: Commit**

```bash
git add pages/side-panel/AGENTS.md
git commit -m "docs(side-panel): 补充历史同步(v2)说明"
```

- [ ] **Step 4: 人工验证清单（交付用户，非本计划自动执行）**

spec §9 的三条阻断用例 + 边界，需人工跑：
1. **用户隔离**：A 登录训练→登出→B 登录，B 的网页/插件 UI 不得出现 A 的历史；A 的历史不得上传到 B 云端。
2. **删除防复活**：A 删除某 session 后，B 重新登录该 session 不复活、不被 B 回灌。
3. **生产域名**：上线前把 `ADMIN_WEB_BASE_URL` 填生产域名、`trustedOrigins` 锁真实扩展 ID（既有发布门禁），验证 GET/POST/DELETE 三方法走通。
4. 边界：未登录纯本地正常；首登匿名迁移确认前不上传，确认后上传；同 id 较新者胜；登出后再登录历史恢复；token 失效停同步。
5. DELETE+body 运行期透传确认（Task 7）。
6. admin_web `:remote` 迁移（Task 1 只做了 `:local`）。

---

## 计划自审

- **Spec 覆盖**：§4.1 表→T1；§4.2 zod→T2；§4.3 数据访问+getMyHistory→T3；§4.4 route→T4；§4.5 网页页→T5；§5.0 storage ownerUserId/选择器→T6；§5.4 background DELETE→T7；§5.1 service→T8；§5.2 同步引擎+反馈回路→T9；§5.3 HistoryModal owner 感知+登出收起+匿名迁移→T10；§7 数据契约贯穿 T2/T8；§8/§9 安全与测试→T11 清单。无遗漏。
- **类型一致性**：`AgentLogSession`(扩展，含 ownerUserId) vs `AgentLogSessionInput`(admin_web，不含)——刻意不同，靠 wire JSON 对齐，上传 `stripOwner`、入库 zod 剥离双保险；`Tombstone {sessionId, deletedAt:number}` 两侧定义一致；`selectVisibleSessions`、`useHistorySync(isLoggedIn, userId)` 签名在 T6/T9/T10 一致。
- **LWW 一致**：服务端 `upsertUserHistory`（T3，active `>=`、tombstone `>`）与合并端 `max(updatedAt, deletedAt)`（T9）一致。
- **无占位符**：每个代码步给出完整代码；`00XX_*.sql` 为 `db:generate` 真实产物（非占位）。
- **已知非本特性 type 错误**（side-panel 既有 6 个）在 T8 标注，门禁口径为「不引入新错误」。
