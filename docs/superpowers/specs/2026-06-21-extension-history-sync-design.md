# 插件历史记录云端同步（v2）设计

- 日期：2026-06-21
- 状态：待评审
- 范围：Chrome 扩展（`pages/side-panel`、`chrome-extension`、`packages/*`）+ Admin Web（`admin_web/`）
- 前置：v1（登录注册 + 配置单向下行）已完成，见 `docs/superpowers/specs/2026-06-20-extension-auth-admin-web-sync-design.md`。本期复用 v1 的认证、background 代理、D1/Drizzle、双通道（bearer route + cookie 服务函数）范式。

## 1. 背景与目标

v1 给扩展加了登录并把 **LLM 配置**单向下行（Admin Web 为权威源）。但**历史记录仍只存在 Chrome 本地**——v1 spec §1 记的痛点「换机即丢」对历史依然成立：用户换机/重装后，过往训练对话全部丢失，也无法在网页端查看。

目标：让登录用户的**历史记录**（`agent-log-storage` 的 `AgentLogSession[]`）云端化——

1. 插件后台**自动上传**历史到 Admin Web。
2. Admin Web 提供**只读历史查看页**（列表 + 详情 + 下载 TXT）。
3. 插件支持**跨设备拉取**：登录时自动把云端历史合并回本地 `HistoryModal`，直接解决「换机即丢」。

关键事实：要同步的是 **`agent-log-storage`**（`packages/storage/lib/impl/agent-log-storage.ts`，即 `HistoryModal` 展示的那份持久历史）。`agent-chat-storage`（当前对话的临时缓冲 live buffer）**不纳入**同步。

## 2. 核心决策

| # | 决策 | 选择 |
|---|------|------|
| 1 | 同步范围 | **插件上传 + 网页只读查看 + 插件跨设备拉取**。非全双向实时；每 `session` 以 `updatedAt` 做 last-write-wins（LWW），不引入冲突合并 |
| 2 | 拉取/合并时机 | **登录时自动合并**：拉云端全量，按 `sessionId` 与本地合并（同 id 取 `updatedAt` 较新者），本地独有的保留并回灌上传 |
| 3 | 删除语义 | **删除即同步删云端**（硬删）：`HistoryModal` 删除/清空时同步 `DELETE` 到云端，不会被下次拉取「复活」 |
| 4 | 网页端能力 | v2 **只读**（查看 + 下载）；网页不改不删历史（全双向留 v3） |
| 5 | D1 存储模型 | **每 session 一行**：`userAgentLog(userId, sessionId, session JSON, updatedAt)`，唯一键 `(userId, sessionId)` |
| 6 | 登录态可编辑性 | 历史**不只读**（区别于 v1 配置）：登录后照常生成、照常上传 |

## 3. 总体架构与数据流

两套后端继续并存、互不干扰：`polymas`（训练内容，`ai-poly` cookie，本期完全不动）与 `Admin Web`（自家 Better Auth）。本特性与 v1 配置同步**正交**——复用同一条 bearer 通道与 background 代理，但走独立的表、路由、hook。

```
[side-panel：训练时生成历史]
   │  useAgentChat / useVoiceAgentChat → agentLogStorage.addEntry/createSession
   ▼
agentLogStorage(chrome.storage.local)
   │  useHistorySync 订阅变更，debounce 后对账（仅登录态）：
   │    · 新增/更新的 session → POST /api/extension/history
   │    · 本地消失的 sessionId → DELETE /api/extension/history
   ▼
[background ADMIN_WEB_REQUEST 代理] ──Authorization: Bearer──► [Admin Web]
   ▲  登录时一次性：GET 全量 → 按 id LWW 合并回本地 → 回灌 POST 本地独有/本地较新
        │                                  ├─ /api/extension/history  (bearer：GET/POST/DELETE)
        │                                  └─ getMyHistory 服务函数    (cookie 会话，只读)
        │                                            │
        │                                  [D1: userAgentLog(userId, sessionId, session JSON, updatedAt)]
        │                                            ▲
        └────────────────────────  [Admin Web /settings/history 只读查看页] ── getMyHistory
```

- **双通道沿用 v1**：扩展跨域调用走 **bearer route**（`Authorization: Bearer`）；网页内（用户有 cookie 会话）走 **服务函数 + authApiMiddleware**。互不依赖。
- **LWW 在服务端兜底**：`POST` upsert 时，仅当传入 `updatedAt >= ` 库中 `updatedAt` 才覆盖，避免旧客户端把另一台设备更新的云端副本写回旧值。

## 4. Admin Web 侧改动（`admin_web/`）

### 4.1 数据库（Drizzle + D1）
- `src/db/app.schema.ts` 新增表 `userAgentLog`：

  | 列 | 类型 | 约束 |
  |----|------|------|
  | `id` | text | primary key |
  | `userId` | text | FK → `user.id`，`onDelete: cascade` |
  | `sessionId` | text | `AgentLogSession.id`（如 `log_...`） |
  | `session` | text | 整份 `AgentLogSession` 的 JSON 字符串 |
  | `updatedAt` | integer(timestamp_ms) | notNull，镜像 `session.updatedAt`，用于 LWW |
  | `createdAt` | integer(timestamp_ms) | notNull |

  - 唯一索引：`(userId, sessionId)`；普通索引：`userId`。
  - 不设 `deletedAt`：删除为硬删（决策 3）。
- `src/db/types.ts`：增加推导类型 `UserAgentLog`。
- 迁移：`pnpm db:generate` 生成，`pnpm db:migrate:local` / `:remote` 应用。

### 4.2 数据契约校验
- 新增 `src/lib/agent-log-schema.ts`：用 zod 镜像扩展的 `AgentLogSession`（见 §7），导出 `agentLogSessionSchema`、`AgentLogSessionInput`。

### 4.3 数据访问 + 服务函数
- 新增 `src/api/extension-history.ts`：
  - 数据访问：`readUserHistory(userId) → AgentLogSession[]`、`upsertUserHistory(userId, sessions)`（逐条按 `(userId, sessionId)` upsert，LWW）、`deleteUserHistory(userId, sessionIds)`。
  - 只读服务函数 `getMyHistory`：`createServerFn().middleware([authApiMiddleware]).handler(...)`，从 `context.userId` 取本人历史，供网页查看页用（cookie 会话）。

### 4.4 接口（扩展用 bearer route）
- 新增 API route `src/routes/api/extension/history.ts`（TanStack Start server route，多方法）：
  - 鉴权：从 `Authorization: Bearer` 经 `auth.api.getSession({ headers })` 解析 `userId`；无 session → 401。
  - `GET` → `200 { sessions: AgentLogSession[] }`（无记录则 `{ sessions: [] }`）。
  - `POST`，body `{ sessions: AgentLogSession[] }`（zod 校验）→ 逐条 LWW upsert → `200 { ok: true }` / 400。
  - `DELETE`，body `{ sessionIds: string[] }` → 删除对应行 → `200 { ok: true }`。

### 4.5 网页查看页
- 新增路由 `src/routes/settings/history.tsx`（与 v1 `/settings/extension` 同级）：**只读**列表 + 详情 + 下载 TXT。
  - 数据来源：`getMyHistory` 服务函数。
  - 复用扩展 `HistoryModal` 的 `buildLogText` 文本格式（`AI: / 用户:` 风格）做下载，保证与插件导出一致。
  - 不提供改名/删除/清空（决策 4：网页只读）。

## 5. 扩展侧改动

### 5.1 服务（`pages/side-panel/src/services/admin-web-service.ts`）
- 新增 `fetchHistory(): Promise<AgentLogSession[]>`、`pushHistory(sessions: AgentLogSession[]): Promise<void>`、`deleteHistory(sessionIds: string[]): Promise<void>`，均经 `background-bridge` 的 `adminWebRequest`（`ADMIN_WEB_REQUEST` 通道 + bearer）。
- 复用既有 401 清会话逻辑（与 v1 `fetchLlmConfig` 一致）。

### 5.2 同步引擎（新 hook `pages/side-panel/src/hooks/useHistorySync.ts`）
挂载于 `SidePanel`，入参 `isLoggedIn`：

1. **登录后一次性合并**：`fetchHistory()` 拉云端 → 与本地 `agentLogStorage.get()` 按 `sessionId` 合并（同 id 取 `updatedAt` 较新者；云端独有的写入本地；本地独有的保留）→ 写回本地 → 对「本地独有 + 本地较新」的 session `pushHistory` 回灌。
2. **实时对账**：`agentLogStorage.subscribe(...)` + debounce（约 3s）。维护上次已同步快照 `Map<sessionId, updatedAt>`：
   - 新增/`updatedAt` 变大的 session → `pushHistory`。
   - 快照里有、当前已消失的 `sessionId` → `deleteHistory`。
   - 成功后更新快照。
3. 仅在 `isLoggedIn` 时运行；登出则停止订阅、清快照，回到纯本地（与 v1 一致）。

> `HistoryModal` **零改动**：其删除/清空只操作 `agentLogStorage`，删除经订阅 diff 自动传播为云端 `DELETE`，无需向 `HistoryModal` 传 props。

### 5.3 UI（`pages/side-panel/src/SidePanel.tsx`）
- 挂载 `useHistorySync(isLoggedIn)`。
- 历史相关 UI（`HistoryModal`、入口按钮）保持现状——登录态**不只读**。

### 5.4 不改动项
- background `chrome-extension/src/background/index.ts`：`ADMIN_WEB_REQUEST` 已支持任意 method + bearer，**无需改**（确认其转发 method/body，DELETE 走通）。
- manifest `host_permissions`、`auth-session-storage`、`auth.ts`（`bearer()` + `trustedOrigins`）：v1 已就位，**无需改**。

## 6. 关键流程

- **生成即上传**：训练中 `addEntry` 更新某 session 的 `updatedAt` → 订阅触发 → debounce 后 `POST` 该 session。
- **登录跨设备恢复**：登录 → `getSession` + 配置下行（v1）→ `useHistorySync` 拉云端、LWW 合并回本地 → `HistoryModal` 立即显示全部历史。
- **删除**：`HistoryModal` 删除/清空 → `agentLogStorage` 变更 → 订阅 diff 出消失的 `sessionId` → `DELETE` 云端。
- **登出**：停止同步，历史回到纯本地可编辑（不清本地已合并的数据）。
- **token 失效**：任意请求 401 → 清登录态、停止同步（v1 已有）。

## 7. 数据契约

### 7.1 `AgentLogSession`（与 `packages/storage/lib/impl/agent-log-storage.ts` 一致）
```
AgentLogSession {
  id: string;                 // 'log_{ts}_{rand}'
  taskId: string;
  taskName?: string;
  createdAt: number;
  updatedAt: number;
  stepNameMapping?: Record<string, string>;
  entries: AgentLogEntry[];
}
AgentLogEntry (= ChatLogEntry) {
  type: 'chat';
  timestamp: number;
  stepId: string;
  stepName?: string;
  round: number;
  source: 'runCard' | 'chat';
  userText?: string;
  aiText?: string;
}
```
Admin Web 用 zod 镜像这套形状校验；扩展端合并时以 `id` 为键、`updatedAt` 比较。

### 7.2 接口
- `GET /api/extension/history` → `200 { sessions: AgentLogSession[] }` / `401`。
- `POST /api/extension/history`，body `{ sessions: AgentLogSession[] }` → `200 { ok: true }`（LWW upsert）/ `400`（校验失败）/ `401`。
- `DELETE /api/extension/history`，body `{ sessionIds: string[] }` → `200 { ok: true }` / `401`。
- 认证：均需 `Authorization: Bearer <token>`。

## 8. 安全与边界
- **明文存 D1**（沿用 v1 决策）：历史含训练对话文本，依赖 Cloudflare 账号与访问控制；如需加密留 v3。
- **MV3 生命周期**：实时上传依赖 side-panel 开着；但历史本就在 side-panel 开着时生成，天然成立。漏传的部分由「下次登录/打开时的合并对账」兜底（POST 本地较新者）。
- **数据量**：v2 的 `GET` 返回全量历史，内部工具量级够用；分页 / `?since=` 增量游标留 v3。
- **polymas 不动**：训练功能与 `ai-poly` 流程保持原样。
- **不纳入同步**：`agent-chat-storage`（当前对话缓冲）。

## 9. 测试
- **手动闭环**：设备 A 登录训练产生历史 → 网页 `/settings/history` 看到 → 设备 B 登录自动合并出现该历史 → 设备 A 删除一条 → 设备 B 重新登录该条不再出现（无复活）。
- **边界**：未登录纯本地正常；首次登录合并不丢本地独有历史；同 id 较新者胜；token 失效停同步。
- 可选 e2e（`tests/e2e`，WebdriverIO）覆盖登录态历史合并与删除传播。

## 10. v3 预告（不在本期）
- 网页端改/删历史（全双向）、冲突可视化。
- 历史增量同步（`?since=` 游标 / 分页）、大体量优化。
- 历史/对话文本加密；社交登录直通。

## 11. 待实现时确认的细节
- `background` 的 `ADMIN_WEB_REQUEST` 是否已透传 `DELETE` method 与请求体（需核实，理论上已支持任意 method）。
- 网页查看页放 `/settings/history` 还是并入 `/settings/extension` 的一个 tab。
- debounce 时长（默认约 3s）与首屏合并是否需要 loading 态提示。
