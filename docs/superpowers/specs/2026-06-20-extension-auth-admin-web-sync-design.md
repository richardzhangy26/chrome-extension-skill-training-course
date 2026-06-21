# 插件登录注册 + Admin Web 配置联动（v1）设计

- 日期：2026-06-20
- 状态：待评审
- 范围：Chrome 扩展（`pages/side-panel`、`chrome-extension`、`packages/*`）+ Admin Web（`admin_web/`）

## 1. 背景与目标

扩展当前把所有用户数据（LLM 配置、学生档位、模拟对话/知识库、语音 TTS、对话历史/日志）都存在 **Chrome 本地存储**里，无账号、无云端、换机即丢、无法在网页端集中管理。

目标：给扩展加**登录/注册**，并与自家 **Admin Web** 联动，让用户登录后能使用在 Admin Web 上"统一配置"的 LLM Base URL / API Key、学生档位等。历史记录的云端化放到 v2。

关键事实：Admin Web 本身是 TanStack Start（Cloudflare Workers + D1）全栈应用，**已内置 Better Auth**（邮箱密码 + Google + `admin` + `apiKey` 插件 + 邮箱验证）。因此**无需引入新的认证方案**——复用现有 Better Auth 即可。本特性的真正工作量在**数据同步层 + Admin Web 配置 UI**，认证只是入口。

## 2. 核心决策

| # | 决策 | 选择 |
|---|------|------|
| 1 | 插件端认证方式 | **插件内直接登录/注册**（邮箱密码表单），用 Better Auth `bearer` token |
| 2 | 范围与节奏 | **分两期**。v1 = 登录 + 配置**单向下行**；历史记录上行/查看 → v2 |
| 3 | 配置主权 | **Admin Web 为权威源**；插件登录态下配置 UI **只读**；未登录保持本地可编辑（现状） |
| 4 | API Key 落库 | **明文存 D1**（内部教学工具，依赖 Cloudflare 账号/访问控制） |

## 3. 总体架构与数据流

- **两套后端并存，互不干扰**：
  - `polymas`（`cloudapi.polymas.com` / `hike-teaching-center.polymas.com`）—— 训练内容源，`ai-poly` cookie 认证，**本期完全不动**。
  - `Admin Web`（自家 Better Auth）—— 本期新增联动。
- **认证 = bearer token**：插件内登录/注册 → 调 Admin Web Better Auth 端点 → 从 `set-auth-token` 响应头取 token，存 `chrome.storage.local` → 之后数据请求带 `Authorization: Bearer <token>`。
- **传输 = 复用 background 代理**：把 Admin Web 域名加入扩展 `host_permissions`，认证与配置请求经 background `fetch` 发出。扩展对 host 权限覆盖域名的请求**绕过 CORS**；服务端只需在 Better Auth 配置 `trustedOrigins` 加扩展 ID（这是 Origin/CSRF 校验，与 CORS 不同）。
- **配置流向 = 单向下行**：Admin Web 为权威源。插件登录后拉取配置写入本地 `llm-config-storage`，登录态下配置 UI 只读；未登录维持现状。

```
[扩展 side-panel UI]
   │  signUp/signIn/getSession/fetchLlmConfig
   ▼
[background 代理 fetch] ──Authorization: Bearer──► [Admin Web]
                                                     ├─ /api/auth/*        (Better Auth + bearer 插件)
                                                     └─ /api/extension/config (bearer 鉴权 → userId → D1)
                                                                                   │
                                                                          [D1: userLlmConfig(userId UNIQUE, config JSON)]
                                                                                   ▲
                                                     [Admin Web 配置页 settings/extension] 编辑写入
```

## 4. Admin Web 侧改动（`admin_web/`）

### 4.1 Better Auth
- `src/auth/auth.ts`：
  - `plugins` 增加 `bearer()`（来自 `better-auth/plugins`）。
  - 顶层增加 `trustedOrigins: ['chrome-extension://<EXTENSION_ID>']`（dev/prod 扩展 ID）。
  - 确认 `emailAndPassword.enabled` 为真（依赖 `websiteConfig.auth?.enableCredentialLogin`）；保持 `requireEmailVerification: true`。
- `src/auth/client.ts`：保持现状即可（bearer 在服务端读取 `Authorization` 头，扩展侧手动带 token，不强依赖客户端插件）。

### 4.2 数据库（Drizzle + D1）
- `src/db/app.schema.ts` 新增表 `userLlmConfig`：

  | 列 | 类型 | 约束 |
  |----|------|------|
  | `id` | text | primary key |
  | `userId` | text | FK → `user.id`，`onDelete: cascade`，**unique** |
  | `config` | text | 存整份 `LLMConfig` 的 JSON 字符串 |
  | `createdAt` | integer(timestamp_ms) | notNull |
  | `updatedAt` | integer(timestamp_ms) | notNull |

  索引：`userId`。整份配置作为一个 JSON blob 存储——最省事、最贴合现有本地模型、字段演进不需要改表。
- 迁移：`pnpm db:generate` 生成迁移，`pnpm db:migrate:local` / `:remote` 应用。
- `src/db/types.ts` 增加推导类型（如需）。

### 4.3 接口
- 新增 API route `src/routes/api/extension/config.ts`（TanStack Start server route）：
  - 鉴权：从请求头 `Authorization: Bearer` 经 `auth.api.getSession({ headers })` 解析出 `userId`；无 session 返回 401。
  - `GET`：返回该用户的 `config`（无记录则返回 `null` / 空）。
  - `POST`：upsert 该用户配置（按 `userId` 唯一）。请求体用 Zod 校验为 `LLMConfig` 形状。
  - 选 API route 而非 `createServerFn`：API route 更适合扩展跨域直接调用。

### 4.4 配置页 UI
- 新增路由（如 `src/routes/settings/extension.tsx` 或 dashboard 下）：表单编辑
  Base URL / API Key / 模型 / 温度等参数 / **学生档位** / 模拟对话内容 / 知识库内容 / 语音 TTS 设置。
- 字段形状直接复用扩展的 `LLMConfig`（见 §7 数据契约），用 `react-hook-form + zod + shadcn`（仓库约定）。
- 保存调用 §4.3 的 `POST`。

## 5. 扩展侧改动

### 5.1 manifest（`chrome-extension/manifest.ts`，勿改生成的 json）
- `host_permissions` 增加 Admin Web 域名：dev（如 `http://localhost:3000/*`）+ prod（部署域名）。可用构建期 env 注入。

### 5.2 存储（`packages/storage/`）
- 新增 `lib/impl/auth-session-storage.ts`：存 `token`、`user`(id/email/name)、`isLoggedIn`、`expiresAt`。
- 从 `packages/storage/lib/impl/index.ts` 导出（项目约定：所有 storage 模块必须在此导出）。

### 5.3 服务与桥接（`pages/side-panel/src/services/`）
- 新增 `admin-web-service.ts`：`signUp / signIn / signOut / getSession / fetchLlmConfig`，经 `background-bridge.ts` 走 background 代理。
- background（`chrome-extension/src/background/index.ts`）：新增消息类型（如 `ADMIN_WEB_REQUEST`）或扩展现有 `API_REQUEST` 以支持带 `Authorization: Bearer` 的 Admin Web 调用。

### 5.4 UI（`pages/side-panel/src/`）
- 新增登录/注册视图（模态或独立面板）：邮箱 + 密码；注册成功提示去邮箱验证。
- 登录后顶部显示账号（email/name）+ 登出入口。
- 登录后拉取配置写入 `llm-config-storage`；`SimulationConfigModal` 与 `options` 页相关配置项在登录态置**只读**（禁用输入 + "去 Admin Web 修改"提示）。

### 5.5 env（`packages/env`）
- `.env.defaults` 增加 Admin Web base URL；在 `packages/env/src/index.ts` 注册；通过 `@extension/env` 引用。

## 6. 关键流程

- **注册**：插件填邮箱密码 → 调 `/api/auth/sign-up/email` → 提示"请到邮箱点验证链接（在浏览器网页打开）" → 验证完成后回插件登录。
- **登录**：调 `/api/auth/sign-in/email` → 从 `set-auth-token` 响应头取 token → 存 `auth-session-storage` → 拉取配置 → 配置 UI 置只读。
- **首次登录种子**：若服务端该用户尚无配置（`GET` 返回空），用插件当前本地 `llm-config-storage` seed 一次（`POST` 上去），避免登录后配置被清空；此后服务端为准。
- **登出**：清 token 与登录态；配置 UI 恢复本地可编辑。
- **token 失效**：任意请求返回 401 → 清登录态、提示重新登录。

## 7. 数据契约

### 7.1 `LLMConfig`（与扩展现有 `packages/storage/lib/impl/llm-config-storage.ts` 一致）
字段：`apiKey, apiUrl, model, temperature, topK, maxTokens, maxHistoryRounds, serviceCode, enabled, systemPromptMode, systemPrompt, studentProfileId, studentProfiles[], dialogueSimulationEnabled, dialogueSimulationContent, knowledgeBaseEnabled, knowledgeBaseContent, voiceModeEnabled, ttsApiUrl, ttsModel, voice, speed, ttsResponseFormat`。
`studentProfiles[]` 项：`{ id, label, description, style, fallbackHint }`。
Admin Web 用 Zod 镜像这套形状校验；扩展端复用既有 `normalizeLLMConfig` 做容错。

### 7.2 接口
- `GET /api/extension/config` → `200 { config: LLMConfig | null }` / `401`。
- `POST /api/extension/config`，body `LLMConfig` → `200 { ok: true }` / `400`（校验失败）/ `401`。
- 认证：均需 `Authorization: Bearer <token>`。

## 8. 安全与边界
- **API Key 明文存 D1**（决策 4），依赖 Cloudflare 账号与访问控制；后续如需可加 Worker secret 对称加密（v2+）。
- **扩展 ID 稳定性**：`trustedOrigins` 需固定扩展 ID。dev 用 manifest `key` 固定其 ID；或临时用 `chrome-extension://*` 并留 TODO 收紧。
- **polymas 不动**：训练功能与 `ai-poly` 流程保持原样；本特性与之正交。
- **Google/社交登录**：扩展端 v1 仅邮箱密码，不做社交登录。

## 9. 测试
- **手动闭环**：注册 → 邮箱验证 → 登录 → 网页改配置 → 插件拉取生效 → 登出恢复本地可编辑。
- **边界**：未登录本地编辑正常；token 失效提示重登；首次登录种子不丢配置。
- 可选 e2e（`tests/e2e`，WebdriverIO）覆盖登录态切换与只读态。

## 10. v2 预告（不在本期）
- 历史记录（`agent-log-storage` / `agent-chat-storage`）上行 + Admin Web 历史查看页。
- 如需：API Key 加密、配置双向同步、社交登录直通。

## 11. 待实现时确认的细节
- Admin Web dev/prod 的确切域名（决定 `host_permissions` 与 `trustedOrigins`）。
- 配置页放在 `settings/` 还是 `dashboard/` 下。
- background 是新增 `ADMIN_WEB_REQUEST` 还是泛化 `API_REQUEST`。
