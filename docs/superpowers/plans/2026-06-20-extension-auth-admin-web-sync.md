# 插件登录注册 + Admin Web 配置联动（v1）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 Chrome 扩展加"插件内邮箱密码登录/注册"，登录后从 Admin Web 单向拉取 LLM 配置与学生档位，登录态下插件配置 UI 只读；Admin Web 为权威配置源。

**Architecture:** 复用 Admin Web 已内置的 Better Auth（新增 `bearer` 插件 + `trustedOrigins`），新增一张 `userLlmConfig`（按 userId 唯一、整份配置存 JSON blob）+ 一个 bearer 鉴权的 `/api/extension/config` 接口 + 一个 `settings/extension` 配置页。扩展侧新增 `auth-session-storage`、background `ADMIN_WEB_REQUEST` 代理、`admin-web-service`、`useAdminWebAuth` hook、登录 UI，并把现有配置弹窗在登录态置只读。

**Tech Stack:** TanStack Start + Better Auth + Drizzle + Cloudflare D1（Admin Web）；React + TypeScript + Chrome MV3 + `@extension/storage`（扩展）。

## 测试策略说明（重要，先读）

本仓库**没有配置单元测试框架**（`admin_web/CLAUDE.md`：_"No test framework is configured. Manual testing via pnpm dev"_；`packages/*` 无 test runner）。按 superpowers 的指令优先级（用户/仓库约定 > 技能默认 TDD）与项目 KISS 原则，本计划**不引入新测试框架**。每个任务以**可执行的真实验证**收尾：`curl` + 预期输出、`pnpm check` / type-check、构建产物检查，或"加载扩展 → 精确点击路径 → 预期 UI/存储状态"。这是对 writing-plans 默认红绿 TDD 的有意适配，理由如上。

## Global Constraints

逐条复制自 spec / 仓库约定，**每个任务都隐含遵守**：

- **勿改生成文件**：扩展端勿手改 `manifest.json`（改 `chrome-extension/manifest.ts`）；Admin Web 勿改 `src/routeTree.gen.ts`、勿手改 `src/db/auth.schema.ts`（Better Auth 生成）。
- **跨包引用用 `@extension/*` 命名空间**，禁止相对路径跨 workspace 边界。
- **扩展 ESLint 严格规则**：用箭头函数表达式（禁 `function` 声明）；所有 `export` 放文件末尾；可点击非交互元素需 `role/tabIndex/onKeyDown/aria-label`；`label` 用 `htmlFor`+`id` 关联；`catch` 不用未使用的绑定（用 `catch {}`）。2 空格缩进、分号、尾逗号。
- **Admin Web 代码风格（Biome）**：2 空格、80 列、单引号、分号、ES5 尾逗号；文件名 kebab-case，组件 PascalCase，hook `useX`；导入用 `@/` 别名；表单用 `react-hook-form + @hookform/resolvers + zod`；服务端状态用 TanStack Query。
- **Cloudflare Workers 运行时**：Admin Web 服务端代码**禁用 Node.js 专有 API**（用 `crypto.randomUUID()` 等 Web API）。
- **数据主权**：Admin Web 是 LLM 配置的唯一权威源；配置仅单向"网页 → 插件"下行；插件登录态只读，未登录维持本地可编辑（现状）。
- **不动 polymas**：`ai-poly` cookie 流程、`API_REQUEST` 代理、训练功能保持原样；新功能与之正交，新增独立的 `ADMIN_WEB_REQUEST` 通道。
- **API Key 落库明文**（内部工具）。
- **配置字段形状**＝扩展现有 `LLMConfig`（见下「配置契约」），两端必须一致。
- **节点版本**：Node ≥ 22.15.1，pnpm 10.11.0。

## 配置契约（`LLMConfig`，两端唯一真相）

来自 `packages/storage/lib/impl/llm-config-storage.ts`，Admin Web 的 Zod schema 必须逐字段镜像：

```
apiKey: string
apiUrl: string
model: string
temperature: number
topK: number
maxTokens: number
maxHistoryRounds: number
serviceCode: string
enabled: boolean
systemPromptMode: 'default' | 'custom'
systemPrompt: string
studentProfileId: string
studentProfiles: Array<{ id: string; label: string; description: string; style: string; fallbackHint: string }>
dialogueSimulationEnabled: boolean
dialogueSimulationContent: string
knowledgeBaseEnabled: boolean
knowledgeBaseContent: string
voiceModeEnabled: boolean
ttsApiUrl: string
ttsModel: string
voice: string
speed: number
ttsResponseFormat: 'mp3' | 'wav' | 'opus'
```

## 前置条件（开工前确认 / 来自 Codex 对抗评审）

1. **事务邮件可达**：插件注册依赖 Better Auth 发"验证邮件"（`requireEmailVerification: true`，`sendVerificationEmail`）。目标环境（本地/生产）必须能真正发出该邮件，否则注册者永远无法验证→无法登录。本地测试有三条可行路径，择一：(a) 临时在 `src/auth/auth.ts` 把 `requireEmailVerification` 设为 `false`；(b) 用 `cd admin_web && pnpm db:studio:local` 手动把测试用户 `user.emailVerified` 置 1；(c) 从 dev server 日志里读出验证链接手动打开。生产环境必须确保 Worker 已配 `RESEND_API_KEY` 且发件域已验证（见 Task 4 验证步骤）。
2. **扩展 ID**：`trustedOrigins` 需要扩展的 `chrome-extension://<id>`。首次 `pnpm build` 后在 `chrome://extensions` 加载 `dist/`，记下扩展 ID，回填到 Task 4。dev 期可临时用 `chrome-extension://*`。
3. **Admin Web 可访问**：扩展 background 通过固定 base URL 直连 Admin Web。dev = `http://localhost:3000`，生产 = 实际部署域名（Task 8 §11 回填）。

## 文件结构（创建/修改总览）

**Admin Web（`admin_web/`）**
- 修改 `src/db/app.schema.ts` —— 新增 `userLlmConfig` 表 + relation（Task 1）
- 生成 `src/db/migrations/00xx_*.sql` —— 迁移（Task 1）
- 修改 `src/db/types.ts` —— 导出 `UserLlmConfig` 类型（Task 1）
- 创建 `src/lib/llm-config-schema.ts` —— 共享 Zod schema + 默认值（Task 2）
- 创建 `src/api/extension-config.ts` —— 数据访问助手 + 网页用 server functions（Task 3）
- 修改 `src/auth/auth.ts` —— 加 `bearer()` + `trustedOrigins`（Task 4）
- 创建 `src/routes/api/extension/config.ts` —— bearer 鉴权的 GET/POST 接口（Task 4）
- 创建 `src/components/settings/extension/extension-config-form.tsx` —— 配置表单（Task 5）
- 创建 `src/routes/settings/extension.tsx` —— 配置页路由（Task 5）

**扩展**
- 创建 `packages/storage/lib/impl/auth-session-storage.ts`；修改 `packages/storage/lib/impl/index.ts`（Task 6）
- 修改 `chrome-extension/src/background/index.ts` —— `ADMIN_WEB_REQUEST` 处理 + base URL 常量（Task 7）
- 创建 `pages/side-panel/src/services/admin-web-service.ts`；修改 `pages/side-panel/src/services/background-bridge.ts`（Task 8）
- 创建 `pages/side-panel/src/hooks/useAdminWebAuth.ts`（Task 9）
- 创建 `pages/side-panel/src/components/AuthPanel.tsx`；修改 `pages/side-panel/src/SidePanel.tsx`（Task 10）
- 修改 `pages/side-panel/src/components/SettingsModal.tsx`、`SimulationConfigModal.tsx` —— 登录态只读（Task 11）；全链路回归 + 文档（Task 12）

> **说明（对 spec 的两处刻意偏离）**：(1) spec 提到加 `host_permissions` 与 env 变量；实测 `manifest.ts` 已含 `<all_urls>`（已覆盖 Admin Web 域名），且 env 包是构建期读根 `.env`（非运行时），而 background 本就硬编码服务 URL（`API_BASE_URL`）。故**不改 manifest、不动 env 包**，base URL 照搬现有"background 常量"模式（Task 8），更稳更贴合现状。(2) 网页 server functions 走 cookie 会话（`authApiMiddleware`），扩展走 bearer 接口，两者复用同一份数据访问助手，保持 DRY。

---

## Task 1: Admin Web —— `userLlmConfig` 表 + 迁移

**Files:**
- Modify: `admin_web/src/db/app.schema.ts`（在文件末尾、`userFilesRelations` 之后追加）
- Modify: `admin_web/src/db/types.ts`
- Create（生成）: `admin_web/src/db/migrations/00xx_*.sql`

**Interfaces:**
- Produces: drizzle 表对象 `userLlmConfig`（列：`id, userId, config, createdAt, updatedAt`）；类型 `UserLlmConfig`。后续 Task 3/4 依赖。

- [ ] **Step 1: 在 `app.schema.ts` 末尾追加表与 relation**

```ts
/**
 * 扩展 LLM 配置：每个用户一份，整份配置以 JSON 字符串存入 config 列。
 */
export const userLlmConfig = sqliteTable(
  'user_llm_config',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: 'cascade' }),
    config: text('config').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [index('user_llm_config_user_id_idx').on(table.userId)]
);

export const userLlmConfigRelations = relations(userLlmConfig, ({ one }) => ({
  user: one(user, {
    fields: [userLlmConfig.userId],
    references: [user.id],
  }),
}));
```

（`sqliteTable / text / integer / index / relations / user` 均已在该文件 import，无需新增 import。）

- [ ] **Step 2: 在 `types.ts` 追加类型导出**

把 `app.schema` 的 import 行改为同时引入新表，并在末尾追加类型：

```ts
import { userFiles, payment, userLlmConfig } from "./app.schema";
// ...原有 export 保持不变...
export type UserLlmConfig = typeof userLlmConfig.$inferSelect;
```

- [ ] **Step 3: 生成迁移**

Run: `cd admin_web && pnpm db:generate`
Expected: 终端输出生成了一个新的 `src/db/migrations/00xx_*.sql`，内含 `CREATE TABLE \`user_llm_config\``。

- [ ] **Step 4: 应用到本地 D1**

Run: `cd admin_web && pnpm db:migrate:local`
Expected: 迁移成功，无报错。

- [ ] **Step 5: 验证表已建**

Run: `cd admin_web && pnpm db:studio:local`（浏览器打开 Drizzle Studio）
Expected: 能看到 `user_llm_config` 表，含 `id/user_id/config/created_at/updated_at` 五列；`user_id` 唯一。确认后关闭 studio。

- [ ] **Step 6: Commit**

```bash
git add admin_web/src/db/app.schema.ts admin_web/src/db/types.ts admin_web/src/db/migrations
git commit -m "feat(admin_web): 新增 userLlmConfig 表存储扩展 LLM 配置"
```

---

## Task 2: Admin Web —— 共享 LLMConfig Zod schema

**Files:**
- Create: `admin_web/src/lib/llm-config-schema.ts`

**Interfaces:**
- Produces: `llmConfigSchema`（Zod object，镜像「配置契约」24 字段）；`type LlmConfigInput = z.infer<typeof llmConfigSchema>`；`defaultLlmConfig: LlmConfigInput`。后续 Task 3/5 复用。

- [ ] **Step 1: 写 schema 文件**

```ts
import { z } from 'zod';

/** 学生档位 */
const studentProfileSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  style: z.string(),
  fallbackHint: z.string(),
});

/**
 * 扩展 LLMConfig 的服务端镜像（与
 * packages/storage/lib/impl/llm-config-storage.ts 的 LLMConfig 一一对应）。
 */
export const llmConfigSchema = z.object({
  apiKey: z.string(),
  apiUrl: z.string(),
  model: z.string(),
  temperature: z.number(),
  topK: z.number().int(),
  maxTokens: z.number().int(),
  maxHistoryRounds: z.number().int(),
  serviceCode: z.string(),
  enabled: z.boolean(),
  systemPromptMode: z.enum(['default', 'custom']),
  systemPrompt: z.string(),
  studentProfileId: z.string(),
  studentProfiles: z.array(studentProfileSchema),
  dialogueSimulationEnabled: z.boolean(),
  dialogueSimulationContent: z.string(),
  knowledgeBaseEnabled: z.boolean(),
  knowledgeBaseContent: z.string(),
  voiceModeEnabled: z.boolean(),
  ttsApiUrl: z.string(),
  ttsModel: z.string(),
  voice: z.string(),
  speed: z.number(),
  ttsResponseFormat: z.enum(['mp3', 'wav', 'opus']),
});

export type LlmConfigInput = z.infer<typeof llmConfigSchema>;

export const defaultLlmConfig: LlmConfigInput = {
  apiKey: '',
  apiUrl: 'http://llm-service.polymas.com/api/openai/v1/chat/completions',
  model: 'Doubao-1.5-pro-32k',
  temperature: 0.7,
  topK: 50,
  maxTokens: 200,
  maxHistoryRounds: 5,
  serviceCode: 'SI_Ability',
  enabled: false,
  systemPromptMode: 'default',
  systemPrompt: '',
  studentProfileId: 'medium',
  studentProfiles: [
    { id: 'good', label: '优秀学生', description: '', style: '', fallbackHint: '' },
    { id: 'medium', label: '需要引导的学生', description: '', style: '', fallbackHint: '' },
    { id: 'bad', label: '答非所问的学生', description: '', style: '', fallbackHint: '' },
  ],
  dialogueSimulationEnabled: false,
  dialogueSimulationContent: '',
  knowledgeBaseEnabled: false,
  knowledgeBaseContent: '',
  voiceModeEnabled: false,
  ttsApiUrl: 'https://llm-service.polymas.com/api/openai/v1/audio/speech/stream',
  ttsModel: 'cosyvoice-v1',
  voice: 'loongstella',
  speed: 1.0,
  ttsResponseFormat: 'mp3',
};
```

- [ ] **Step 2: 验证类型与解析**

Run: `cd admin_web && pnpm exec tsx -e "import { llmConfigSchema, defaultLlmConfig } from './src/lib/llm-config-schema.ts'; console.log(llmConfigSchema.parse(defaultLlmConfig).model)"`
Expected: 打印 `Doubao-1.5-pro-32k`（解析通过，无抛错）。

- [ ] **Step 3: Lint**

Run: `cd admin_web && pnpm check`
Expected: 无新增报错（或 `pnpm lint` 自动修复后干净）。

- [ ] **Step 4: Commit**

```bash
git add admin_web/src/lib/llm-config-schema.ts
git commit -m "feat(admin_web): 新增共享 LLMConfig zod schema"
```

---

## Task 3: Admin Web —— 数据访问助手 + 网页 server functions

**Files:**
- Create: `admin_web/src/api/extension-config.ts`

**Interfaces:**
- Consumes: `getDb()`（`@/db`）、`userLlmConfig`（`@/db/app.schema`）、`llmConfigSchema/defaultLlmConfig`（`@/lib/llm-config-schema`）、`authApiMiddleware`（`@/middlewares/auth-middleware`，提供 `context.userId`）。
- Produces:
  - `readUserLlmConfig(userId: string): Promise<LlmConfigInput | null>`
  - `writeUserLlmConfig(userId: string, config: LlmConfigInput): Promise<void>`
  - server fn `getMyLlmConfig`（GET，返回 `{ config: LlmConfigInput | null }`）
  - server fn `saveMyLlmConfig`（POST，入参 `LlmConfigInput`，返回 `{ ok: true }`）
  Task 4（bearer 接口）复用 `readUserLlmConfig/writeUserLlmConfig`；Task 5（网页）用两个 server fn。

- [ ] **Step 1: 写数据访问助手 + server functions**

```ts
import { getDb } from '@/db';
import { userLlmConfig } from '@/db/app.schema';
import {
  llmConfigSchema,
  type LlmConfigInput,
} from '@/lib/llm-config-schema';
import { authApiMiddleware } from '@/middlewares/auth-middleware';
import { createServerFn } from '@tanstack/react-start';
import { eq } from 'drizzle-orm';

/** 读取某用户的 LLM 配置；无记录返回 null。 */
export async function readUserLlmConfig(
  userId: string
): Promise<LlmConfigInput | null> {
  const db = getDb();
  const [row] = await db
    .select({ config: userLlmConfig.config })
    .from(userLlmConfig)
    .where(eq(userLlmConfig.userId, userId))
    .limit(1);
  if (!row) {
    return null;
  }
  // 容错：库里坏数据时返回 null 而非抛错。
  const parsed = llmConfigSchema.safeParse(JSON.parse(row.config));
  return parsed.success ? parsed.data : null;
}

/** upsert 某用户的 LLM 配置（按 userId 唯一）。 */
export async function writeUserLlmConfig(
  userId: string,
  config: LlmConfigInput
): Promise<void> {
  const db = getDb();
  const now = new Date();
  const serialized = JSON.stringify(config);
  await db
    .insert(userLlmConfig)
    .values({
      id: crypto.randomUUID(),
      userId,
      config: serialized,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userLlmConfig.userId,
      set: { config: serialized, updatedAt: now },
    });
}

export const getMyLlmConfig = createServerFn({ method: 'GET' })
  .middleware([authApiMiddleware])
  .handler(async ({ context }) => {
    const config = await readUserLlmConfig(context.userId);
    return { config };
  });

export const saveMyLlmConfig = createServerFn({ method: 'POST' })
  .inputValidator(llmConfigSchema)
  .middleware([authApiMiddleware])
  .handler(async ({ data, context }) => {
    await writeUserLlmConfig(context.userId, data);
    return { ok: true as const };
  });
```

- [ ] **Step 2: 类型检查**

Run: `cd admin_web && pnpm check`
Expected: 无新增报错。（如 `context.userId` 类型不被识别，确认 `authApiMiddleware` 的 `next({ context: { userId } })` 已生效——它在 `src/middlewares/auth-middleware.ts` 已实现。）

- [ ] **Step 3: Commit**

```bash
git add admin_web/src/api/extension-config.ts
git commit -m "feat(admin_web): 扩展配置数据访问助手与网页 server functions"
```

---

## Task 4: Admin Web —— bearer 插件 + trustedOrigins + bearer 接口

**Files:**
- Modify: `admin_web/src/auth/auth.ts:12`（import）、`:19` 之后（加 `trustedOrigins`）、`:109-132`（plugins 数组）
- Create: `admin_web/src/routes/api/extension/config.ts`

**Interfaces:**
- Consumes: `auth`（`@/auth/auth`）、`readUserLlmConfig/writeUserLlmConfig`（`@/api/extension-config`）、`llmConfigSchema`（`@/lib/llm-config-schema`）。
- Produces: HTTP 端点 `GET /api/extension/config` → `{ config: LlmConfigInput | null }`；`POST /api/extension/config`（body=LLMConfig）→ `{ ok: true }`；均需 `Authorization: Bearer <token>`。扩展 Task 9 依赖这两个路径。

- [ ] **Step 1: auth.ts 引入 bearer 并加入 plugins**

把 `src/auth/auth.ts:12` 的 import 改为：

```ts
import { admin, apiKey, bearer } from 'better-auth/plugins';
```

在 `plugins: [` 数组里（`tanstackStartCookies()` 同级）加一行：

```ts
    // https://www.better-auth.com/docs/plugins/bearer
    // 浏览器扩展用 Authorization: Bearer 鉴权（登录响应头 set-auth-token 返回 token）
    bearer(),
```

- [ ] **Step 2: auth.ts 加 trustedOrigins**

在 `betterAuth({` 配置对象顶层（紧跟 `baseURL` 之后）加入：

```ts
  // 浏览器扩展来源（CSRF/Origin 校验）。dev 期可临时用 'chrome-extension://*'；
  // 生产务必锁定真实扩展 ID（见计划「前置条件 2」）。
  trustedOrigins: [
    'chrome-extension://REPLACE_WITH_EXTENSION_ID',
  ],
```

（实现时把 `REPLACE_WITH_EXTENSION_ID` 换成 `chrome://extensions` 里看到的真实 ID；dev 不确定时先用 `'chrome-extension://*'`。）

- [ ] **Step 3: 创建 bearer 接口路由**

`src/routes/api/extension/config.ts`：

```ts
import { createFileRoute } from '@tanstack/react-router';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { auth } from '@/auth/auth';
import {
  readUserLlmConfig,
  writeUserLlmConfig,
} from '@/api/extension-config';
import { llmConfigSchema } from '@/lib/llm-config-schema';

const jsonResponse = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const requireUserId = async (): Promise<string | null> => {
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });
  if (!session?.user || !session.user.emailVerified) {
    return null;
  }
  return session.user.id;
};

export const Route = createFileRoute('/api/extension/config')({
  server: {
    handlers: {
      GET: async () => {
        const userId = await requireUserId();
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }
        const config = await readUserLlmConfig(userId);
        return jsonResponse({ config });
      },
      POST: async ({ request }) => {
        const userId = await requireUserId();
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }
        const parsed = llmConfigSchema.safeParse(await request.json());
        if (!parsed.success) {
          return jsonResponse({ error: 'Invalid config' }, 400);
        }
        await writeUserLlmConfig(userId, parsed.data);
        return jsonResponse({ ok: true });
      },
    },
  },
});
```

- [ ] **Step 4: 起本地 dev server**

Run: `cd admin_web && pnpm dev`（保持运行，端口 3000）
Expected: 启动无报错。

- [ ] **Step 5: 准备一个"已验证"的测试用户并取 token**

按「前置条件 1」让一个测试账号 `emailVerified=1`（最快：临时把 `requireEmailVerification` 设 false，或 studio 改库）。然后取 bearer token：

Run（替换邮箱密码）：
```bash
curl -i -s -X POST http://localhost:3000/api/auth/sign-in/email \
  -H 'Content-Type: application/json' \
  -H 'Origin: chrome-extension://REPLACE_WITH_EXTENSION_ID' \
  -d '{"email":"test@example.com","password":"Password123!"}' | grep -i 'set-auth-token'
```
Expected: 响应头出现 `set-auth-token: <一串 token>`。记下该 token。
（若被 Origin 拒绝，确认 Task 4 Step 2 的 `trustedOrigins` 含该 Origin 或临时用 `'chrome-extension://*'`。）

- [ ] **Step 6: 用 token 验证 GET/POST**

Run（替换 `<TOKEN>`）：
```bash
TOKEN='<TOKEN>'
# 初次应为 null
curl -s http://localhost:3000/api/extension/config -H "Authorization: Bearer $TOKEN"
# 写入一份最小配置
curl -s -X POST http://localhost:3000/api/extension/config \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"apiKey":"sk-test","apiUrl":"https://x","model":"m","temperature":0.7,"topK":50,"maxTokens":200,"maxHistoryRounds":5,"serviceCode":"SI_Ability","enabled":true,"systemPromptMode":"default","systemPrompt":"","studentProfileId":"medium","studentProfiles":[],"dialogueSimulationEnabled":false,"dialogueSimulationContent":"","knowledgeBaseEnabled":false,"knowledgeBaseContent":"","voiceModeEnabled":false,"ttsApiUrl":"https://t","ttsModel":"tm","voice":"v","speed":1,"ttsResponseFormat":"mp3"}'
# 再读应回显 apiKey=sk-test
curl -s http://localhost:3000/api/extension/config -H "Authorization: Bearer $TOKEN"
# 无 token 应 401
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/extension/config
```
Expected: 第 1 条 `{"config":null}`；第 2 条 `{"ok":true}`；第 3 条回显含 `"apiKey":"sk-test"`；第 4 条 `401`。

- [ ] **Step 7:（生产前）核对事务邮件配置**

Run: `cd admin_web && grep -i RESEND .env .env.production 2>/dev/null; echo '--- 检查 websiteConfig.mail.provider ---'; grep -n "provider" src/config/website.ts`
Expected: 确认目标环境已配 `RESEND_API_KEY` 且发件域已验证；否则注册验证邮件不会真正送达（Codex 评审高危项）。仅本地测试可用「前置条件 1」绕过。

- [ ] **Step 8: Commit**

```bash
git add admin_web/src/auth/auth.ts admin_web/src/routes/api/extension/config.ts
git commit -m "feat(admin_web): 启用 bearer 鉴权并提供扩展配置接口"
```

---

## Task 5: Admin Web —— `settings/extension` 配置页

**Files:**
- Create: `admin_web/src/components/settings/extension/extension-config-form.tsx`
- Create: `admin_web/src/routes/settings/extension.tsx`

**Interfaces:**
- Consumes: `getMyLlmConfig/saveMyLlmConfig`（`@/api/extension-config`）、`llmConfigSchema/defaultLlmConfig/LlmConfigInput`（`@/lib/llm-config-schema`）。
- Produces: 路由 `/settings/extension`，登录用户可编辑并保存 LLM 配置。

- [ ] **Step 1: 写表单组件（schema 驱动，避免逐字段重复）**

`src/components/settings/extension/extension-config-form.tsx`：

```tsx
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  getMyLlmConfig,
  saveMyLlmConfig,
} from '@/api/extension-config';
import {
  defaultLlmConfig,
  llmConfigSchema,
  type LlmConfigInput,
} from '@/lib/llm-config-schema';

type FieldDef = {
  name: keyof LlmConfigInput;
  label: string;
  type: 'text' | 'password' | 'number' | 'textarea' | 'checkbox';
};

// 仅列出适合直接表单编辑的字段；studentProfiles 用 JSON 文本编辑（见下）。
const FIELDS: FieldDef[] = [
  { name: 'apiKey', label: 'API Key', type: 'password' },
  { name: 'apiUrl', label: 'Base URL', type: 'text' },
  { name: 'model', label: '模型', type: 'text' },
  { name: 'temperature', label: 'Temperature', type: 'number' },
  { name: 'topK', label: 'Top K', type: 'number' },
  { name: 'maxTokens', label: 'Max Tokens', type: 'number' },
  { name: 'maxHistoryRounds', label: '最大历史轮数', type: 'number' },
  { name: 'serviceCode', label: 'Service Code', type: 'text' },
  { name: 'systemPrompt', label: '系统提示词', type: 'textarea' },
  { name: 'dialogueSimulationContent', label: '模拟对话内容', type: 'textarea' },
  { name: 'knowledgeBaseContent', label: '知识库内容', type: 'textarea' },
  { name: 'ttsApiUrl', label: 'TTS Base URL', type: 'text' },
  { name: 'ttsModel', label: 'TTS 模型', type: 'text' },
  { name: 'voice', label: '音色', type: 'text' },
  { name: 'speed', label: '语速', type: 'number' },
];

export function ExtensionConfigForm() {
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profilesText, setProfilesText] = useState('[]');
  const {
    register,
    handleSubmit,
    reset,
    setValue,
  } = useForm<LlmConfigInput>({
    resolver: zodResolver(llmConfigSchema),
    defaultValues: defaultLlmConfig,
  });

  useEffect(() => {
    getMyLlmConfig().then(({ config }) => {
      const value = config ?? defaultLlmConfig;
      reset(value);
      setProfilesText(JSON.stringify(value.studentProfiles, null, 2));
      setLoaded(true);
    });
  }, [reset]);

  const onSubmit = async (data: LlmConfigInput) => {
    setSaved(false);
    // enabled 随 apiKey 派生
    const payload = { ...data, enabled: data.apiKey.trim().length > 0 };
    await saveMyLlmConfig({ data: payload });
    setSaved(true);
  };

  if (!loaded) {
    return <p className="text-sm text-muted-foreground">加载中…</p>;
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex max-w-xl flex-col gap-4"
    >
      {FIELDS.map((f) => (
        <div key={f.name} className="flex flex-col gap-1">
          <label htmlFor={f.name} className="text-sm font-medium">
            {f.label}
          </label>
          {f.type === 'textarea' ? (
            <textarea
              id={f.name}
              className="min-h-24 rounded-md border px-3 py-2 text-sm"
              {...register(f.name)}
            />
          ) : (
            <input
              id={f.name}
              type={f.type}
              className="rounded-md border px-3 py-2 text-sm"
              {...register(f.name, {
                valueAsNumber: f.type === 'number',
              })}
            />
          )}
        </div>
      ))}

      <div className="flex flex-col gap-1">
        <label htmlFor="studentProfiles" className="text-sm font-medium">
          学生档位（JSON 数组）
        </label>
        <textarea
          id="studentProfiles"
          className="min-h-40 rounded-md border px-3 py-2 font-mono text-xs"
          value={profilesText}
          onChange={(e) => {
            setProfilesText(e.target.value);
            try {
              setValue('studentProfiles', JSON.parse(e.target.value));
            } catch {
              // 非法 JSON 暂不更新表单值，提交时由 zod 校验拦截
            }
          }}
        />
        <p className="text-xs text-muted-foreground">
          每项：{'{ id, label, description, style, fallbackHint }'}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          保存
        </button>
        {saved && <span className="text-sm text-emerald-600">已保存</span>}
      </div>
    </form>
  );
}
```

> 注：本表单覆盖大多数字段；`studentProfileId / systemPromptMode / *Enabled / voiceModeEnabled / ttsResponseFormat` 这些枚举/开关若需在网页编辑，可在实现时按相同 `register` 模式补 `<select>`/`<input type=checkbox>`。MVP 先保证核心字段可编辑并完整持久化（未在表单出现的字段，因 `reset(value)` 已载入，会原样回写，不丢失）。

- [ ] **Step 2: 写路由页（仿 `settings/files.tsx`）**

`src/routes/settings/extension.tsx`：

```tsx
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ExtensionConfigForm } from '@/components/settings/extension/extension-config-form';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/extension')({
  component: ExtensionSettingsPage,
});

function ExtensionSettingsPage() {
  const breadcrumbs = [
    { label: '设置', isCurrentPage: false },
    { label: '插件配置', isCurrentPage: true },
  ];
  return (
    <DashboardLayout
      breadcrumbs={breadcrumbs}
      title="插件配置"
      description="集中配置 Chrome 插件使用的 LLM 与学生档位，登录后插件自动拉取。"
    >
      <ExtensionConfigForm />
    </DashboardLayout>
  );
}
```

（`/settings` 父路由已带 `authRouteMiddleware`，本页自动要求登录。`routeTree.gen.ts` 由 dev server 自动重生成，勿手改。）

- [ ] **Step 3: 验证页面可用**

dev server 运行中，浏览器登录后访问 `http://localhost:3000/settings/extension`。
Expected: 表单加载出当前配置（或默认值）；改 `API Key`/`模型`后点"保存"显示"已保存"；刷新页面后值仍在（已持久化到 D1）。

- [ ] **Step 4: Lint + Commit**

Run: `cd admin_web && pnpm check`
Expected: 无新增报错。

```bash
git add admin_web/src/components/settings/extension admin_web/src/routes/settings/extension.tsx admin_web/src/routeTree.gen.ts
git commit -m "feat(admin_web): 新增插件配置页 settings/extension"
```

---

## Task 6: 扩展 —— `auth-session-storage` 存储模块

**Files:**
- Create: `packages/storage/lib/impl/auth-session-storage.ts`
- Modify: `packages/storage/lib/impl/index.ts`

**Interfaces:**
- Produces: `authSessionStorage`（`@extension/storage`），数据形如 `{ token: string | null; user: { id; email; name } | null; isLoggedIn: boolean }`；方法 `setSession(token, user)`、`clear()`、外加基类的 `get/set/subscribe`。Task 7/8/9 依赖。

- [ ] **Step 1: 写存储模块（仿 `agent-session-storage.ts` 模式）**

```ts
/**
 * 登录会话存储：保存 Admin Web 的 bearer token 与用户信息。
 */

import { createStorage, StorageEnum } from '../base/index.js';
import type { BaseStorageType } from '../base/index.js';

interface AuthUser {
  id: string;
  email: string;
  name: string;
}

interface AuthSession {
  token: string | null;
  user: AuthUser | null;
  isLoggedIn: boolean;
}

interface AuthSessionStorageType extends BaseStorageType<AuthSession> {
  setSession: (token: string, user: AuthUser) => Promise<void>;
  clear: () => Promise<void>;
}

const defaultSession: AuthSession = {
  token: null,
  user: null,
  isLoggedIn: false,
};

const storage = createStorage<AuthSession>('auth-session-storage-key', defaultSession, {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});

const authSessionStorage: AuthSessionStorageType = {
  ...storage,
  setSession: async (token, user) => {
    await storage.set({ token, user, isLoggedIn: true });
  },
  clear: async () => {
    await storage.set(defaultSession);
  },
};

export { authSessionStorage };
export type { AuthUser, AuthSession, AuthSessionStorageType };
```

- [ ] **Step 2: 在 impl/index.ts 导出**

在 `packages/storage/lib/impl/index.ts` 追加一行（与其它 `export * from './xxx.js'` 同级）：

```ts
export * from './auth-session-storage.js';
```

- [ ] **Step 3: 类型检查**

Run: `pnpm -F @extension/storage type-check` （若无该脚本则 `pnpm type-check`）
Expected: 无新增报错。

- [ ] **Step 4: Commit**

```bash
git add packages/storage/lib/impl/auth-session-storage.ts packages/storage/lib/impl/index.ts
git commit -m "feat(storage): 新增 auth-session-storage 保存登录会话"
```

---

## Task 7: 扩展 —— background `ADMIN_WEB_REQUEST` 代理

**Files:**
- Modify: `chrome-extension/src/background/index.ts`

**Interfaces:**
- Consumes: `authSessionStorage`（`@extension/storage`）。
- Produces: 新消息类型 `ADMIN_WEB_REQUEST`，payload `{ path, method, body?, auth? }`，返回 `{ success, data: { status, ok, json, setAuthToken } }`。Task 8 依赖。

- [ ] **Step 1: 在 background 顶部加常量与类型**

在 `chrome-extension/src/background/index.ts` 的常量区（`API_BASE_URL` 附近）加：

```ts
// Admin Web 基址：dev=本地，prod=部署域名（见计划「前置条件 3」，prod 待回填）
const ADMIN_WEB_BASE_URL = 'http://localhost:3000';

interface AdminWebRequestPayload {
  path: string;
  method: 'GET' | 'POST';
  body?: Record<string, unknown>;
  auth?: boolean;
}
```

把第 16 行的联合类型补上新成员：

```ts
type BackgroundMessageType =
  | 'GET_CURRENT_TAB_URL'
  | 'GET_AUTH'
  | 'EXTRACT_TRAIN_TASK_ID'
  | 'API_REQUEST'
  | 'ADMIN_WEB_REQUEST';
```

并在顶部 import 追加：

```ts
import { exampleThemeStorage, authSessionStorage } from '@extension/storage';
```
（替换原来只 import `exampleThemeStorage` 的那行。）

- [ ] **Step 2: 在 switch 里加分支**

在 `handleMessage` 的 `switch` 中，`case 'API_REQUEST':` 之后加：

```ts
    case 'ADMIN_WEB_REQUEST':
      return handleAdminWebRequest(message.payload as AdminWebRequestPayload);
```

- [ ] **Step 3: 实现 handler**

在 `handleApiRequest` 函数之后追加：

```ts
// ============ Admin Web 请求代理（bearer，不注入 polymas 认证） ============
const handleAdminWebRequest = async (
  payload: AdminWebRequestPayload,
): Promise<BackgroundResponse<{ status: number; ok: boolean; json: unknown; setAuthToken: string | null }>> => {
  try {
    const { path, method, body, auth } = payload;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    if (auth) {
      const session = await authSessionStorage.get();
      if (session.token) {
        headers['Authorization'] = `Bearer ${session.token}`;
      }
    }

    const url = `${ADMIN_WEB_BASE_URL}${path}`;
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const setAuthToken = response.headers.get('set-auth-token');
    let json: unknown = null;
    try {
      json = await response.json();
    } catch {
      json = null;
    }

    return {
      success: true,
      data: { status: response.status, ok: response.ok, json, setAuthToken },
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
};
```

- [ ] **Step 4: 构建验证**

Run: `pnpm -F chrome-extension build` （或全量 `pnpm build`）
Expected: 构建成功，无 TS 报错。

- [ ] **Step 5: Commit**

```bash
git add chrome-extension/src/background/index.ts
git commit -m "feat(background): 新增 ADMIN_WEB_REQUEST 代理支持 bearer 鉴权"
```

---

## Task 8: 扩展 —— `admin-web-service` + bridge

**Files:**
- Modify: `pages/side-panel/src/services/background-bridge.ts`
- Create: `pages/side-panel/src/services/admin-web-service.ts`

**Interfaces:**
- Consumes: background `ADMIN_WEB_REQUEST`；`authSessionStorage`（`@extension/storage`）。
- Produces:
  - bridge: `adminWebRequest(payload): Promise<{ status; ok; json; setAuthToken }>`
  - service: `signUp({email,password,name})`、`signIn({email,password})`、`signOut()`、`getSession()`、`fetchLlmConfig()`、`pushLlmConfig(config)`。返回结构见下。Task 9 依赖（Task 10 经 hook 间接调用）。

- [ ] **Step 1: bridge 加 `adminWebRequest`**

在 `background-bridge.ts` 内（`apiRequest` 之后）加，并加入末尾 `export`：

```ts
interface AdminWebRequestPayload {
  path: string;
  method: 'GET' | 'POST';
  body?: Record<string, unknown>;
  auth?: boolean;
}

interface AdminWebResponse {
  status: number;
  ok: boolean;
  json: unknown;
  setAuthToken: string | null;
}

const adminWebRequest = async (payload: AdminWebRequestPayload): Promise<AdminWebResponse> => {
  const response = await sendMessage<AdminWebResponse>('ADMIN_WEB_REQUEST', payload);
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Admin Web request failed');
  }
  return response.data;
};
```

把文件末尾 export 改为同时导出：

```ts
export { getCurrentTabUrl, getAuth, extractTrainTaskId, apiRequest, onTabUrlChanged, API_ENDPOINTS, adminWebRequest };
export type { AdminWebRequestPayload, AdminWebResponse };
```

- [ ] **Step 2: 写 service**

`pages/side-panel/src/services/admin-web-service.ts`：

```ts
/**
 * Admin Web 联动服务：登录/注册/会话/配置同步。
 * 经 background ADMIN_WEB_REQUEST 代理直连 Admin Web。
 */

import { adminWebRequest } from './background-bridge';
import { authSessionStorage } from '@extension/storage';
import type { AuthUser } from '@extension/storage';
import type { LLMConfig } from '@extension/storage';

interface AuthResult {
  ok: boolean;
  error?: string;
  needsVerification?: boolean;
}

const extractUser = (json: unknown): AuthUser | null => {
  if (!json || typeof json !== 'object') {
    return null;
  }
  const u = (json as { user?: { id?: string; email?: string; name?: string } }).user;
  if (!u?.id || !u.email) {
    return null;
  }
  return { id: u.id, email: u.email, name: u.name ?? '' };
};

const signUp = async (input: { email: string; password: string; name: string }): Promise<AuthResult> => {
  const res = await adminWebRequest({
    path: '/api/auth/sign-up/email',
    method: 'POST',
    body: input,
  });
  if (!res.ok) {
    const msg = (res.json as { message?: string })?.message ?? `注册失败(${res.status})`;
    return { ok: false, error: msg };
  }
  // 开启了邮箱验证：注册成功但需先去邮箱验证再登录
  return { ok: true, needsVerification: true };
};

const signIn = async (input: { email: string; password: string }): Promise<AuthResult> => {
  const res = await adminWebRequest({
    path: '/api/auth/sign-in/email',
    method: 'POST',
    body: input,
  });
  if (!res.ok) {
    if (res.status === 403) {
      return { ok: false, needsVerification: true, error: '邮箱尚未验证，请先到邮箱完成验证' };
    }
    const msg = (res.json as { message?: string })?.message ?? `登录失败(${res.status})`;
    return { ok: false, error: msg };
  }
  const user = extractUser(res.json);
  if (!res.setAuthToken || !user) {
    return { ok: false, error: '登录响应缺少令牌或用户信息' };
  }
  await authSessionStorage.setSession(res.setAuthToken, user);
  return { ok: true };
};

const signOut = async (): Promise<void> => {
  try {
    await adminWebRequest({ path: '/api/auth/sign-out', method: 'POST', auth: true });
  } catch {
    // 网络失败也要本地登出
  }
  await authSessionStorage.clear();
};

const getSession = async (): Promise<AuthUser | null> => {
  const res = await adminWebRequest({ path: '/api/auth/get-session', method: 'GET', auth: true });
  if (!res.ok) {
    if (res.status === 401) {
      await authSessionStorage.clear();
    }
    return null;
  }
  return extractUser(res.json);
};

const fetchLlmConfig = async (): Promise<LLMConfig | null> => {
  const res = await adminWebRequest({ path: '/api/extension/config', method: 'GET', auth: true });
  if (!res.ok) {
    if (res.status === 401) {
      await authSessionStorage.clear();
    }
    return null;
  }
  return ((res.json as { config?: LLMConfig | null }).config) ?? null;
};

const pushLlmConfig = async (config: LLMConfig): Promise<boolean> => {
  const res = await adminWebRequest({
    path: '/api/extension/config',
    method: 'POST',
    auth: true,
    body: config as unknown as Record<string, unknown>,
  });
  return res.ok;
};

export { signUp, signIn, signOut, getSession, fetchLlmConfig, pushLlmConfig };
export type { AuthResult };
```

- [ ] **Step 3: 构建验证**

Run: `pnpm -F side-panel build`
Expected: 构建成功，无 TS 报错。

- [ ] **Step 4: Commit**

```bash
git add pages/side-panel/src/services/background-bridge.ts pages/side-panel/src/services/admin-web-service.ts
git commit -m "feat(side-panel): 新增 admin-web-service 与 bridge 通道"
```

---

## Task 9: 扩展 —— `useAdminWebAuth` hook（登录态 + 拉取/种子/失效）

**Files:**
- Create: `pages/side-panel/src/hooks/useAdminWebAuth.ts`

**Interfaces:**
- Consumes: `admin-web-service`（signIn/signUp/signOut/getSession/fetchLlmConfig/pushLlmConfig）、`authSessionStorage`、`llmConfigStorage`（`@extension/storage`）。
- Produces: hook 返回 `{ session, isLoggedIn, loading, error, login, register, logout, refreshConfig }`。`isLoggedIn` 供 Task 11/12 控制 UI 与只读。

- [ ] **Step 1: 写 hook**

```ts
/**
 * Admin Web 登录态 hook：管理会话、登录/注册/登出，
 * 并在登录后把账号配置下行到本地 llmConfigStorage（首次登录种子）。
 */

import { useCallback, useEffect, useState } from 'react';
import {
  signIn,
  signUp,
  signOut,
  getSession,
  fetchLlmConfig,
  pushLlmConfig,
} from '../services/admin-web-service';
import { authSessionStorage, llmConfigStorage } from '@extension/storage';
import type { AuthSession } from '@extension/storage';

const useAdminWebAuth = () => {
  const [session, setSession] = useState<AuthSession>({ token: null, user: null, isLoggedIn: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 订阅本地会话存储（登出/失效时 UI 同步）
  useEffect(() => {
    let active = true;
    authSessionStorage.get().then(s => active && setSession(s));
    const unsubscribe = authSessionStorage.subscribe(() => {
      authSessionStorage.get().then(s => active && setSession(s));
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // 登录后把账号配置写入本地；服务端无配置则用本地 seed 上去一次
  const syncConfigDown = useCallback(async () => {
    const remote = await fetchLlmConfig();
    if (remote) {
      await llmConfigStorage.setConfig(remote);
      return;
    }
    const local = await llmConfigStorage.get();
    await pushLlmConfig(local);
  }, []);

  // 启动时校验既有 token 是否仍有效
  useEffect(() => {
    (async () => {
      const current = await authSessionStorage.get();
      if (current.isLoggedIn) {
        const user = await getSession();
        if (user) {
          await syncConfigDown();
        }
        // getSession 内部在 401 时已 clear()，订阅会刷新 UI
      }
      setLoading(false);
    })();
  }, [syncConfigDown]);

  const login = useCallback(
    async (email: string, password: string) => {
      setError(null);
      const result = await signIn({ email, password });
      if (!result.ok) {
        setError(result.error ?? '登录失败');
        return result;
      }
      await syncConfigDown();
      return result;
    },
    [syncConfigDown],
  );

  const register = useCallback(async (email: string, password: string, name: string) => {
    setError(null);
    const result = await signUp({ email, password, name });
    if (!result.ok) {
      setError(result.error ?? '注册失败');
    }
    return result;
  }, []);

  const logout = useCallback(async () => {
    await signOut();
  }, []);

  return {
    session,
    isLoggedIn: session.isLoggedIn,
    loading,
    error,
    login,
    register,
    logout,
    refreshConfig: syncConfigDown,
  };
};

export { useAdminWebAuth };
```

- [ ] **Step 2: 构建验证**

Run: `pnpm -F side-panel build`
Expected: 构建成功，无 TS 报错。

- [ ] **Step 3: Commit**

```bash
git add pages/side-panel/src/hooks/useAdminWebAuth.ts
git commit -m "feat(side-panel): 新增 useAdminWebAuth 管理登录态与配置下行"
```

---

## Task 10: 扩展 —— `AuthPanel` 登录/注册 UI + SidePanel 集成

**Files:**
- Create: `pages/side-panel/src/components/AuthPanel.tsx`
- Modify: `pages/side-panel/src/SidePanel.tsx`（Header 区挂账号/登录入口 + 挂 AuthPanel 弹窗）

**Interfaces:**
- Consumes: `useAdminWebAuth`（Task 9）。
- Produces: `AuthPanel`（受控弹窗）；SidePanel 顶部显示账号或"登录"按钮。`isLoggedIn` 透传给 Task 12。

- [ ] **Step 1: 写 AuthPanel 组件**

`pages/side-panel/src/components/AuthPanel.tsx`（样式沿用现有弹窗：遮罩 + 渐变头部；交互元素带 a11y 属性）：

```tsx
import { useState } from 'react';

interface AuthPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (email: string, password: string) => Promise<{ ok: boolean; error?: string; needsVerification?: boolean }>;
  onRegister: (
    email: string,
    password: string,
    name: string,
  ) => Promise<{ ok: boolean; error?: string; needsVerification?: boolean }>;
}

const AuthPanel = ({ isOpen, onClose, onLogin, onRegister }: AuthPanelProps) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    const result =
      mode === 'login' ? await onLogin(email, password) : await onRegister(email, password, name);
    setBusy(false);
    if (result.ok && mode === 'register') {
      setMessage('注册成功！请到邮箱点击验证链接（在浏览器网页打开），验证后再登录。');
      setMode('login');
      return;
    }
    if (result.ok) {
      onClose();
      return;
    }
    setMessage(result.error ?? '操作失败');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        onKeyDown={e => e.key === 'Escape' && onClose()}
        role="button"
        tabIndex={0}
        aria-label="关闭登录弹窗"
      />
      <div className="relative w-[90%] max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="bg-gradient-to-r from-teal-500 to-cyan-500 px-5 py-4">
          <h2 className="text-lg font-semibold text-white">{mode === 'login' ? '登录' : '注册'}</h2>
        </div>
        <div className="space-y-3 p-5">
          {mode === 'register' && (
            <div>
              <label htmlFor="auth-name" className="mb-1 block text-sm font-medium text-slate-700">
                昵称
              </label>
              <input
                id="auth-name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
              />
            </div>
          )}
          <div>
            <label htmlFor="auth-email" className="mb-1 block text-sm font-medium text-slate-700">
              邮箱
            </label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor="auth-password" className="mb-1 block text-sm font-medium text-slate-700">
              密码
            </label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
            />
          </div>
          {message && <p className="text-sm text-amber-600">{message}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="w-full rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 py-2.5 text-sm font-medium text-white disabled:opacity-50">
            {busy ? '处理中…' : mode === 'login' ? '登录' : '注册'}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setMessage(null);
            }}
            className="w-full text-center text-xs text-cyan-600 hover:text-cyan-700">
            {mode === 'login' ? '没有账号？去注册' : '已有账号？去登录'}
          </button>
        </div>
      </div>
    </div>
  );
};

export { AuthPanel };
```

- [ ] **Step 2: SidePanel 引入 hook 与 AuthPanel**

在 `pages/side-panel/src/SidePanel.tsx` 顶部 import 区加：

```tsx
import { AuthPanel } from './components/AuthPanel';
import { useAdminWebAuth } from './hooks/useAdminWebAuth';
```

在 SidePanel 主组件内（与其它 `useState` 同级）加：

```tsx
const { isLoggedIn, session, login, register, logout } = useAdminWebAuth();
const [isAuthOpen, setIsAuthOpen] = useState(false);
```

- [ ] **Step 3: 在 Header 区域显示账号/登录入口**

在 SidePanel 的顶部按钮区（`<SettingsModal ... />` 挂载点附近、或 Header 渲染处）加一个入口：

```tsx
{isLoggedIn ? (
  <button
    type="button"
    onClick={logout}
    title={session.user?.email}
    className="rounded-lg px-2 py-1 text-xs text-slate-600 hover:bg-slate-100">
    {session.user?.name || session.user?.email}（登出）
  </button>
) : (
  <button
    type="button"
    onClick={() => setIsAuthOpen(true)}
    className="rounded-lg px-2 py-1 text-xs font-medium text-cyan-600 hover:bg-cyan-50">
    登录
  </button>
)}
```

并在 SidePanel return 的弹窗挂载区（`<SettingsModal .../>` 旁）加：

```tsx
<AuthPanel
  isOpen={isAuthOpen}
  onClose={() => setIsAuthOpen(false)}
  onLogin={login}
  onRegister={register}
/>
```

- [ ] **Step 4: 构建 + 手动闭环验证**

Run: `pnpm build` 然后在 `chrome://extensions` 重新加载 `dist/`，打开侧面板（Admin Web dev server 须运行中）。
Expected（精确点击路径）：
  1. 顶部出现"登录"按钮 → 点开 AuthPanel。
  2. 切到"注册"，填邮箱/密码/昵称 → 提交 → 出现"请到邮箱验证"提示。
  3. 按「前置条件 1」让该用户 `emailVerified=1`。
  4. 回到登录，输入同邮箱密码 → 提交 → 弹窗关闭，顶部显示账号名 +（登出）。
  5. 在 Admin Web `settings/extension` 改 `模型` 并保存 → 在插件点（登出）再登录（或刷新侧面板）→ 打开设置弹窗，模型已变为网页所设值（配置下行生效）。
  6. 点（登出）→ 顶部恢复"登录"按钮。

- [ ] **Step 5: Commit**

```bash
git add pages/side-panel/src/components/AuthPanel.tsx pages/side-panel/src/SidePanel.tsx
git commit -m "feat(side-panel): 新增登录注册面板与账号入口"
```

---

## Task 11: 扩展 —— 登录态下配置 UI 只读

**Files:**
- Modify: `pages/side-panel/src/components/SettingsModal.tsx`
- Modify: `pages/side-panel/src/components/SimulationConfigModal.tsx`
- Modify: `pages/side-panel/src/SidePanel.tsx`（把 `isLoggedIn` 作为 `readOnly` 传入两个弹窗）

**Interfaces:**
- Consumes: `isLoggedIn`（来自 Task 9 hook，经 SidePanel 透传）。
- Produces: 两个配置弹窗在 `readOnly` 时禁用所有输入并显示"配置由 Admin Web 管理"提示。

- [ ] **Step 1: SettingsModal 增加 `readOnly` prop**

把 `interface SettingsModalProps`（`SettingsModal.tsx:54-57`）改为：

```ts
interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  readOnly?: boolean;
}
```

组件签名改为 `const SettingsModal = ({ isOpen, onClose, readOnly = false }: SettingsModalProps) => {`。

- [ ] **Step 2: 用 `<fieldset disabled>` 一次性禁用所有输入 + 顶部 banner**

在 `SettingsModal.tsx` 的内容区（`{/* 内容 */}` 那个 `<div className="max-h-...overflow-y-auto p-5">`）内，把其 children 包进一个 `<fieldset>`，并在其上方插入 banner：

```tsx
{readOnly && (
  <div className="mb-3 rounded-lg bg-cyan-50 p-3 text-xs text-cyan-700">
    已登录：配置由 Admin Web 统一管理，请前往网页「设置 → 插件配置」修改。
  </div>
)}
<fieldset disabled={readOnly} className="m-0 border-0 p-0">
  {/* 原有 activeTab 内容整体移入此 fieldset */}
</fieldset>
```

并在底部按钮区（"测试连接"/"保存配置"）外层加 `{!readOnly && ( ... )}`，登录态隐藏保存/测试。

> `<fieldset disabled>` 会禁用其内部所有 `input/textarea/select/button`，无需逐个改——这是本任务的关键省力点。

- [ ] **Step 3: SimulationConfigModal 同法处理**

给 `SimulationConfigModal` 增加 `readOnly?: boolean`，把其表单主体包进 `<fieldset disabled={readOnly}>`，并在顶部加同样的 banner、隐藏保存类按钮。（其 props interface 与主体结构见该文件；模式与 Step 1-2 一致。）

- [ ] **Step 4: SidePanel 透传 `readOnly={isLoggedIn}`**

把 SidePanel 里两处挂载改为：

```tsx
<SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} readOnly={isLoggedIn} />
```
SimulationConfigModal 的挂载同样补 `readOnly={isLoggedIn}`。

- [ ] **Step 5: 构建 + 手动验证**

Run: `pnpm build` → 重新加载扩展。
Expected：
  - 未登录：打开设置/模拟配置弹窗，所有输入可编辑、有保存按钮（现状不变）。
  - 已登录：打开同弹窗，顶部出现 cyan 提示，所有输入灰掉不可改，保存/测试按钮消失。

- [ ] **Step 6: Commit**

```bash
git add pages/side-panel/src/components/SettingsModal.tsx pages/side-panel/src/components/SimulationConfigModal.tsx pages/side-panel/src/SidePanel.tsx
git commit -m "feat(side-panel): 登录态下配置弹窗只读"
```

---

## Task 12: 全链路回归 + 文档

**Files:**
- Modify: `CLAUDE.md` 或 `pages/side-panel/AGENTS.md`（补一段登录/配置联动说明）

**Interfaces:** 无新增。

- [ ] **Step 1: 手动全链路回归（按 spec §9 闭环）**

Admin Web dev server + 重新加载的扩展都就绪后，依次验证并逐条打勾：
  - [ ] 注册 → 邮箱验证（或前置条件 1 模拟）→ 登录成功
  - [ ] 登录后插件配置弹窗只读、显示"去 Admin Web 修改"
  - [ ] 网页改配置 → 插件重新登录/刷新后下行生效
  - [ ] 首次登录种子：用一个服务端无配置的新账号登录，确认本地原有配置被 seed 到网页（`settings/extension` 能看到）、本地未被清空
  - [ ] 登出 → 配置 UI 恢复可编辑（本地）
  - [ ] token 失效：手动在 `settings/extension` 之外，或等会话过期；或临时把本地 token 改坏 → 任一受保护请求返回 401 后插件自动登出、提示重登
  - [ ] polymas 训练功能（文本/语音）不受影响，照常工作

- [ ] **Step 2: 补文档**

在 `pages/side-panel/AGENTS.md`（或根 `CLAUDE.md` 架构段）追加一小节：登录态来自 `useAdminWebAuth` + `authSessionStorage`；配置经 `admin-web-service` 从 `/api/extension/config` 下行；Admin Web 为权威源、插件只读；v2 再做历史上行。

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: 补充插件登录与 Admin Web 配置联动说明"
```

---

## v2（不在本计划）
- 历史记录（`agent-log-storage` / `agent-chat-storage`）上行 + Admin Web 历史查看页。
- 可选：API Key 加密、配置双向同步、社交登录直通、`trustedOrigins` 收紧到固定扩展 ID（用 manifest `key`）。
