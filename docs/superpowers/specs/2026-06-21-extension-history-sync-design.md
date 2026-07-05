# 插件历史记录云端同步（v2）设计

- 日期：2026-06-21
- 状态：待评审（已折入一轮 Codex 对抗式评审 + advisor 收紧）
- 范围：Chrome 扩展（`pages/side-panel`、`chrome-extension`、`packages/*`）+ Admin Web（`admin_web/`）
- 前置：v1（登录注册 + 配置单向下行）已完成并经 PR #5 合并，见 `docs/superpowers/specs/2026-06-20-extension-auth-admin-web-sync-design.md`。本期复用 v1 的认证、background 代理、D1/Drizzle、双通道（bearer route + cookie 服务函数）范式。

## 1. 背景与目标

v1 给扩展加了登录并把 **LLM 配置**单向下行（Admin Web 为权威源）。但**历史记录仍只存在 Chrome 本地**——v1 spec §1 记的痛点「换机即丢」对历史依然成立：用户换机/重装后，过往训练对话全部丢失，也无法在网页端查看。

目标：让登录用户的**历史记录**（`agent-log-storage` 的 `AgentLogSession[]`）云端化——

1. 插件后台**自动上传**当前用户的历史到 Admin Web。
2. Admin Web 提供**只读历史查看页**（列表 + 详情 + 下载 TXT）。
3. 插件支持**跨设备拉取**：登录时自动把云端历史合并回本地 `HistoryModal`，直接解决「换机即丢」。

关键事实：要同步的是 **`agent-log-storage`**（`packages/storage/lib/impl/agent-log-storage.ts`，即 `HistoryModal` 展示的那份持久历史）。`agent-chat-storage`（当前对话的临时缓冲 live buffer）**不纳入**同步。

## 2. 核心决策

| # | 决策 | 选择 |
|---|------|------|
| 1 | 同步范围 | **插件上传 + 网页只读查看 + 插件跨设备拉取**。非全双向实时；每 `session` 以 `updatedAt` 做 last-write-wins（LWW），不引入冲突合并 |
| 2 | 拉取/合并时机 | **登录时自动合并**：拉云端（含 tombstone），按 `sessionId` 与本地合并，本地独有/较新的回灌上传 |
| 3 | 删除语义 | **tombstone 软删 + 跨设备防复活**（修订自原「纯硬删」）：删除在云端打墓碑（`deletedAt`），合并时用 `max(updatedAt, deletedAt)` 判胜，删除胜出则清本地且不回灌 |
| 4 | 网页端能力 | v2 **只读**（查看 + 下载）；网页不改不删历史（全双向留 v3） |
| 5 | D1 存储模型 | **每 session 一行**：`userAgentLog(userId, sessionId, session JSON, updatedAt, deletedAt?)`，唯一键 `(userId, sessionId)` |
| 6 | 登录态可编辑性 | 历史**不只读**（区别于 v1 配置）：登录后照常生成、照常上传 |
| 7 | 用户隔离 | 每 session 带**本地字段** `ownerUserId`；同步与 UI 均按当前登录 userId 过滤。服务端**只按 bearer token 的 userId 归属**（D1 `userId` 列权威），不信也不持久化客户端的 `ownerUserId` |

## 3. 总体架构与数据流

两套后端继续并存、互不干扰：`polymas`（训练内容，`ai-poly` cookie，本期完全不动）与 `Admin Web`（自家 Better Auth）。本特性与 v1 配置同步**正交**——复用同一条 bearer 通道与 background 代理，但走独立的表、路由、hook。

```
[side-panel：训练时生成历史]
   │  useAgentChat / useVoiceAgentChat → agentLogStorage.createSession/addEntry
   │     createSession 在登录态下盖 ownerUserId = 当前U（匿名则留空）
   ▼
agentLogStorage(chrome.storage.local)
   │  useHistorySync 订阅变更，debounce 后对账（仅登录态、仅 ownerUserId===U 的 session）：
   │    · 新增/更新 → POST /api/extension/history（上传时剥离 ownerUserId）
   │    · 本地消失的 sessionId → DELETE /api/extension/history（服务端打 tombstone）
   ▼
[background ADMIN_WEB_REQUEST 代理] ──Authorization: Bearer──► [Admin Web]
   ▲  登录时一次性：GET {sessions, tombstones} → tombstone 感知合并 → 一次批量写回本地
   │     → 回灌 POST 本地独有/本地较新（下载项按 U 重新盖 ownerUserId）
        │                                  ├─ /api/extension/history  (bearer：GET/POST/DELETE)
        │                                  └─ getMyHistory 服务函数    (cookie 会话，只读)
        │                                            │
        │                                  [D1: userAgentLog(userId, sessionId, session JSON, updatedAt, deletedAt?)]
        │                                            ▲
        └────────────────────────  [Admin Web /settings/history 只读查看页] ── getMyHistory（仅 active）
```

- **双通道沿用 v1**：扩展跨域调用走 **bearer route**（`Authorization: Bearer`）；网页内（用户有 cookie 会话）走 **服务函数 + authApiMiddleware**。互不依赖。
- **归属权威在服务端**：上传时客户端剥离 `ownerUserId`，服务端按 token userId 写 D1 `userId` 列；下载时客户端按当前 U 重新盖 `ownerUserId`。该字段是纯本地过滤用，不在云端持久化。
- **LWW + tombstone**：`POST` upsert 仅当传入 `updatedAt >=` 库中 `updatedAt` 才覆盖；删除走软删（`deletedAt`）。合并以 `max(updatedAt, deletedAt)` 判每个 session 的最终状态。

## 4. Admin Web 侧改动（`admin_web/`）

### 4.1 数据库（Drizzle + D1）
- `src/db/app.schema.ts` 新增表 `userAgentLog`：

  | 列 | 类型 | 约束 |
  |----|------|------|
  | `id` | text | primary key |
  | `userId` | text | FK → `user.id`，`onDelete: cascade`（权威归属） |
  | `sessionId` | text | `AgentLogSession.id`（如 `log_...`） |
  | `session` | text | 整份 `AgentLogSession` 的 JSON 字符串；tombstone 行可置空以省空间 |
  | `updatedAt` | integer(timestamp_ms) | notNull，镜像 `session.updatedAt`，用于 LWW |
  | `deletedAt` | integer(timestamp_ms) | nullable；非空即 tombstone（决策 3 软删） |
  | `createdAt` | integer(timestamp_ms) | notNull |

  - 唯一索引：`(userId, sessionId)`；普通索引：`userId`。
  - **软删**：DELETE 置 `deletedAt` 并清空 `session` 体，不物理删行——GET 才能把 tombstone 返给其它设备防复活。
- `src/db/types.ts`：增加推导类型 `UserAgentLog`。
- 迁移：`pnpm db:generate` 生成，`pnpm db:migrate:local` / `:remote` 应用。

### 4.2 数据契约校验
- 新增 `src/lib/agent-log-schema.ts`：用 zod 镜像扩展的 `AgentLogSession`（见 §7）。**上传体不含 `ownerUserId`**（服务端按 token 归属），若客户端误带应被 schema 剥离/忽略。导出 `agentLogSessionSchema`、`AgentLogSessionInput`。

### 4.3 数据访问 + 服务函数
- 新增 `src/api/extension-history.ts`：
  - 数据访问：
    - `readUserHistory(userId) → { sessions: AgentLogSession[]; tombstones: { sessionId: string; deletedAt: number }[] }`（active 行回 session，tombstone 行回 `{sessionId, deletedAt}`）。
    - `upsertUserHistory(userId, sessions)`：逐条按 `(userId, sessionId)` upsert。LWW 规则：active 行仅当传入 `updatedAt >=` 现有 `updatedAt` 才覆盖；**已 tombstone 的行仅当传入 `updatedAt > deletedAt` 才复活并覆盖（清 `deletedAt`），否则忽略保持 tombstone**——服务端独立自防御，不依赖客户端已正确消费 tombstone，挡住「等时间戳陈旧副本复活」。
    - `deleteUserHistory(userId, sessionIds)`：置 `deletedAt = now`、清 `session` 体（软删）。
  - 只读服务函数 `getMyHistory`：`createServerFn().middleware([authApiMiddleware]).handler(...)`，从 `context.userId` 取本人 **active** 历史（不返 tombstone），供网页查看页用。

### 4.4 接口（扩展用 bearer route）
- 新增 API route `src/routes/api/extension/history.ts`（TanStack Start server route，多方法）：
  - 鉴权：从 `Authorization: Bearer` 经 `auth.api.getSession({ headers })` 解析 `userId`；无 session → 401。
  - `GET` → `200 { sessions: AgentLogSession[]; tombstones: { sessionId: string; deletedAt: number }[] }`。
  - `POST`，body `{ sessions: AgentLogSession[] }`（zod 校验，归属取 token userId）→ LWW upsert → `200 { ok: true }` / 400。
  - `DELETE`，body `{ sessionIds: string[] }` → 软删（打 tombstone）→ `200 { ok: true }`。

### 4.5 网页查看页
- 新增路由 `src/routes/settings/history.tsx`（与 v1 `/settings/extension` 同级）：**只读**列表 + 详情 + 下载 TXT。
  - 数据来源：`getMyHistory` 服务函数（仅 active，不显示 tombstone）。
  - 复用扩展 `HistoryModal` 的 `buildLogText` 文本格式（`AI: / 用户:` 风格）做下载，保证与插件导出一致。
  - 不提供改名/删除/清空（决策 4：网页只读）。

## 5. 扩展侧改动

### 5.0 存储（`packages/storage/lib/impl/agent-log-storage.ts`）
- `AgentLogSession` 增加可选字段 `ownerUserId?: string`（§7.1）。
- `createSession` 落库前读 `authSessionStorage`：登录态盖 `ownerUserId = 当前user.id`，匿名则不设。
- 不改其余方法签名；新增一个纯函数选择器 `selectVisibleSessions(all, currentUserId)`（见 §5.3）供 UI 与同步引擎共用，避免两处过滤逻辑漂移。

### 5.1 服务（`pages/side-panel/src/services/admin-web-service.ts`）
- 新增 `fetchHistory(): Promise<{ sessions: AgentLogSession[]; tombstones: Tombstone[] }>`、`pushHistory(sessions): Promise<void>`、`deleteHistory(sessionIds): Promise<void>`，均经 `background-bridge` 的 `adminWebRequest`（`ADMIN_WEB_REQUEST` 通道 + bearer）。
- `pushHistory` 上传前**剥离 `ownerUserId`**。复用既有 401 清会话逻辑（与 v1 `fetchLlmConfig` 一致）。

### 5.2 同步引擎（新 hook `pages/side-panel/src/hooks/useHistorySync.ts`）
挂载于 `SidePanel`，入参 `isLoggedIn` 与当前 `userId`。维护内存快照 `snapshot: Map<sessionId, updatedAt>` 与一个 `ready` 标志。

**(1) 登录后一次性合并（tombstone 感知）**——对当前用户 U：
1. `fetchHistory()` → `{ cloudSessions, tombstones }`（皆属 U）；构造 `tomb = Map(sessionId → deletedAt)`。
2. 取本地 `ownerUserId === U` 的 session 集合 `localU`（其余用户/匿名的不参与本合并）。
3. 对 `cloudSessions ∪ localU` 的每个 `sessionId`，比较三个事件时刻 `cloud.updatedAt`、`local.updatedAt`、`tomb[id]`，取最大：
   - tombstone 胜 → 从本地移除该 session，**不**回灌；
   - cloud 胜 → 写本地（盖 `ownerUserId = U`）；
   - local 胜（含本地独有）→ 标记待 `pushHistory`。
4. **一次批量 `set` 落地**合并后的完整本地列表；随后对「待回灌」集合 `pushHistory`。
5. 合并完成后，把 `snapshot` 直接设为「对账后状态」（所有 U 的 session 的最终 `updatedAt`），再置 `ready = true`。

**(2) 实时对账**——`agentLogStorage.subscribe(...)` + debounce（约 3s），仅在 `ready` 后处理：
   - 只看 `ownerUserId === U` 的 session：相对 `snapshot` 新增/`updatedAt` 变大 → `pushHistory`；snapshot 有、现已消失 → `deleteHistory`。
   - 成功后更新 `snapshot`。

**关键约束（务必实现，否则出 bug）**：合并阶段自身会写 `agentLogStorage` 并触发订阅。必须 **(a)** 合并用单次批量 `set`；**(b)** 订阅引擎在 `ready` 之前不处理任何变更；**(c)** 合并结束时把 `snapshot` 设成对账后状态——这样合并引发的 storage 事件 diff 出来为空，不会把刚拉下来的 session 又 POST 回去、或把按 tombstone 删的又 DELETE 一遍，也避免 debounce 在合并写到半截时拿陈旧快照算出错误操作。

**(3) 匿名历史迁移**：首登时若检测到 `ownerUserId` 未设的本地 session，弹**一次**确认「是否把本地历史归入当前账号」。确认 → 盖 `ownerUserId = U` 后纳入 (1) 的回灌；否则保持本地、不上传（决策 7：匿名迁移须显式确认）。

**(4) 登出**：停止订阅、清 `snapshot`/`ready`，回到纯本地（不清本地已合并数据）。

### 5.3 UI（`HistoryModal` / `SidePanel`）
- `SidePanel` 挂载 `useHistorySync(isLoggedIn, userId)`。
- **`HistoryModal` 改为 owner 感知**（不再是「零改动」）：用 `selectVisibleSessions(all, currentUserId)` 取可见集——
  - 登录态：显示 `ownerUserId === U` 的 session（+ 待迁移的匿名项，带「归入账号」提示）；
  - 登出态：仅显示匿名（`ownerUserId` 未设）的 session。
- **有意设计：登出后「自己的历史从 UI 消失」**。U 训练后登出，`HistoryModal` 不再显示 U 的历史（只剩匿名项）。数据并未删除，再次登录即恢复——这是用户隔离的正确取舍（同一 Chrome profile 下 B 不应看到 A 的对话）。此行为须在 UI 上有轻提示，避免被误判为「历史丢了」。
- 历史相关交互（删除/清空/改名）保持现状——登录态**不只读**；删除经订阅 diff 自动传播为云端软删。

### 5.4 background 与既有件
- **纳入 v2 scope**（修订自原「无需改」）：
  - `chrome-extension/src/background/index.ts` 与 `pages/side-panel/src/services/background-bridge.ts` 的 `AdminWebRequestPayload` method 联合类型从 `GET | POST` 扩展到含 `DELETE`；确认 background 转发任意 method 并透传 DELETE 请求体。加一次 type-check + 手动 DELETE 透传验证。
- **既有发布门禁（非本期新问题，沿用 v1 清单）**：`ADMIN_WEB_BASE_URL` 仍是 `http://localhost:3000`，上线前须填生产域名；`trustedOrigins` 须锁真实扩展 ID。spec 不再把 background 标为「无需改」。
- **确实不改**：`auth-session-storage`、`auth.ts`（`bearer()` + `trustedOrigins` 已就位）、manifest `host_permissions`（Admin Web 域名 v1 已加）。

## 6. 关键流程

- **生成即上传**：训练中 `addEntry` 更新某 session 的 `updatedAt`（该 session `ownerUserId===U`）→ 订阅触发 → debounce 后 `POST` 该 session（剥离 ownerUserId）。
- **登录跨设备恢复**：登录 → `getSession` + 配置下行（v1）→ `useHistorySync` 拉云端（含 tombstone）→ tombstone 感知合并 → `HistoryModal` 显示 U 的全部历史。
- **删除**：`HistoryModal` 删除/清空 → `agentLogStorage` 变更 → 订阅 diff 出消失的 `sessionId` → `DELETE`（服务端打 tombstone）→ 其它设备下次登录合并时按 `deletedAt` 判删、不复活。
- **登出**：停止同步；`HistoryModal` 收起 U 的历史（只剩匿名项），数据保留，再登录恢复。
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
  ownerUserId?: string;       // 新增：纯本地过滤字段；上传剥离、服务端不持久化
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
Tombstone { sessionId: string; deletedAt: number }
```
Admin Web 用 zod 镜像 `AgentLogSession`（不含 `ownerUserId`）。合并以 `id` 为键、用 `max(updatedAt, deletedAt)` 比较。

### 7.2 接口
- `GET /api/extension/history` → `200 { sessions: AgentLogSession[]; tombstones: Tombstone[] }` / `401`。
- `POST /api/extension/history`，body `{ sessions: AgentLogSession[] }` → `200 { ok: true }`（LWW upsert，归属取 token userId）/ `400` / `401`。
- `DELETE /api/extension/history`，body `{ sessionIds: string[] }` → `200 { ok: true }`（软删打 tombstone）/ `401`。
- 认证：均需 `Authorization: Bearer <token>`。

## 8. 安全与边界
- **用户隔离**（决策 7）：同步与 UI 均按 `ownerUserId`/当前登录 userId 过滤；服务端按 bearer token 归属，绝不信客户端 `ownerUserId`。堵住「同一 profile 下 A 历史被当成 B 的本地独有上传到 B 云端」的租户串号。
- **删除防复活**（决策 3）：tombstone + `max(updatedAt, deletedAt)` 合并，确保跨设备删除不被旧本地副本回灌复活。
- **明文存 D1**（沿用 v1 决策）：历史含训练对话文本，依赖 Cloudflare 账号与访问控制；如需加密留 v3。
- **MV3 生命周期**：实时上传依赖 side-panel 开着；但历史本就在 side-panel 开着时生成，天然成立。漏传的部分由「下次登录合并对账」兜底。
- **数据量**：v2 的 `GET` 返回全量（active + tombstone），内部工具量级够用；分页 / `?since=` 增量与 tombstone 清理留 v3。
- **polymas 不动**：训练功能与 `ai-poly` 流程保持原样。
- **不纳入同步**：`agent-chat-storage`（当前对话缓冲）。

## 9. 测试
- **手动闭环**：设备 A 登录训练产生历史 → 网页 `/settings/history` 看到 → 设备 B 登录自动合并出现该历史 → 设备 A 删除一条 → 设备 B 重新登录该条不再出现（无复活）。
- **三条阻断用例（对应三个 high finding，必须过）**：
  1. **多账号同浏览器**：A 登录训练→登出→B 登录，B 的云端/UI **不得**出现 A 的历史。
  2. **两设备删除后重登**：A 删除某 session 后，B 重新登录该 session 不复活、且不被 B 回灌。
  3. **生产域名请求**：扩展打到配置的生产 Admin Web 域名（非 `localhost:3000`），GET/POST/DELETE 三方法均走通。
- **其它边界**：未登录纯本地正常；首登匿名迁移确认前不上传；同 id 较新者胜；登出后再登录历史恢复；token 失效停同步。
- 可选 e2e（`tests/e2e`，WebdriverIO）覆盖登录态历史合并与删除传播。

## 10. v3 预告（不在本期）
- 网页端改/删历史（全双向）、冲突可视化。
- 历史增量同步（`?since=` 游标 / 分页）、**tombstone 定期清理 / GET 返回上限**（v2 tombstone 在 `userAgentLog` 永久累积，量大后需 GC）。
- 历史/对话文本加密；社交登录直通。
- 匿名历史更完善的迁移/认领体验。

## 11. 待实现时确认的细节
- 网页查看页放 `/settings/history` 还是并入 `/settings/extension` 的一个 tab。
- debounce 时长（默认约 3s）与首屏合并的 loading 态提示。
- DELETE 带 body 经 `fetch`/TanStack Start 一般可行；若实现期踩坑，退路是 `POST { action: 'delete', sessionIds }`。
- 登出后历史从 UI 收起的轻提示文案。
