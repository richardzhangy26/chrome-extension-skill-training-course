# 配置权威反转：插件为唯一编辑入口、Admin Web 只读

> 本文档由 `/grill-me` 逐题拍板产出，记录共识与任务分解，供后续 `writing-plans` / `subagent-driven-development` 落地。

**Goal:** 把 LLM 配置的编辑权威从 Admin Web 反转到插件——插件成为 7 个同步字段的**唯一编辑入口**，保存即自动上传；Admin Web 配置页改为**只读查看**。历史记录同步与 Web 只读历史查看**已存在**，本期不动。目标是"在插件改好保存 → 自动上传 → 换设备登录后继续用；Web 只用于查看最新配置与历史"。

**Architecture:** 服务端（D1 `userLlmConfig`，keyed by `userId`）退化为**被动同步中枢**；插件是唯一写入方，last-write-wins。下拉（server→local）只在**显式登录**时发生，不再每次启动/聚焦自动下拉。单用户内部工具，不引入时间戳强一致。

---

## 现状盘点（关键前提）

- ✅ **历史同步已双向实时**：`useHistorySync`（tombstone 感知，`SidePanel:1111` 已挂载）。本期不动。
- ✅ **Web 已有只读历史页**：`/settings/history` + `ExtensionHistoryView`。本期不动。
- ⚠️ **配置只做了一半**：登录/启动/聚焦会把服务端配置下拉覆盖本地；但插件**改完保存不会上传**（仅"首次登录且服务端为空"播种一次）。
- ❌ **方向相反**：当前 Admin Web 配置表单**可编辑**，插件登录后反而**锁死** 7 字段（`readOnly` 时 `disabled`）。这正是要反转的部分。
- 📌 **只有两处写 7 个同步字段**：`SettingsModal.handleSave`、`SimulationConfigModal.handleSave`。多角色编辑器只读全局配置做运行时覆盖、不落盘。→ "保存即上传"直接写这两个保存函数，最简单，**不可能死循环**（保存只在用户点击时触发，永不在下拉时触发）。

## 决策记录（grill-me 拍板）

| # | 决策点 | 结论 |
|---|--------|------|
| 1 | 编辑模型 | **插件唯一编辑，Web 只读**。LLM 配置没有任何字段需留在 Web 改；账号/认证类（改密码、换邮箱、登出、注销）仍在 Web（Better Auth 范畴，非配置）。后端 `POST /api/extension/config` 路由**保留**，仅 Web UI 去掉保存。 |
| 2 | 同步范围 | **保持当前 7 字段**：`apiKey/apiUrl/model/systemPrompt/studentProfiles/dialogueSimulationContent/knowledgeBaseContent`。TTS/采样/启用开关/当前选中档位仍为设备本地，不同步。 |
| 3 | 下拉时机 | **仅登录时下拉**。移除 SidePanel 聚焦/可见性下拉 effect；启动仍校验 token 但不再拉配置。彻底消除"保存后被聚焦下拉覆盖"。保存失败 = 本地照存 + 非阻塞提示，不上时间戳。 |
| 4 | 未提交改动 | **在其上继续，只撤销两个弹窗的锁定**。保留 storage/schema/Web 表单收窄/SidePanel 开关解锁；仅把两个弹窗对 7 字段的 `disabled={readOnly}` 改回可编辑。 |
| 5 | Web 只读呈现 | **就地只读**：复用现有表单，input/textarea 设 disabled、去掉保存按钮、顶部提示"配置请在插件中修改"；apiKey 仍密码掩码。 |
| 6 | 登录冲突 | **登录采用云端**：服务端有配置→下拉覆盖本地 7 字段；服务端为空→播种本地。 |

---

## 端到端目标流

1. **登出**：插件全本地、全可编辑（不变）。
2. **登录**：拉服务端配置（有则覆盖本地 7 字段，空则播种）；历史照旧 `useHistorySync` 合并。
3. **登录态编辑**：插件里 7 字段**可编辑**，保存 = 本地写入 + `pushLlmConfig(pickSyncedConfig(...))`；推送失败弹非阻塞提示，本地仍保存成功。
4. **登录态运行**：不再有启动/聚焦自动下拉。
5. **换设备登录**：拉到最新配置 + 历史。
6. **Web**：只读配置视图 + 只读历史视图。

---

## 实现任务分解

### 扩展侧

- [x] **撤销两个弹窗的字段锁定**（反转未提交改动）
  - `SettingsModal.tsx`：移除 7 个同步字段上新加的 `disabled={readOnly}` / 锁定 `fieldset`，改回可编辑。保留已统一的底部 save+test 按钮布局。
  - `SimulationConfigModal.tsx`：移除两个 textarea 的 `disabled={readOnly}`；去掉多余的"保存本地开关"按钮，回归单一保存。
  - `readOnly` prop 语义从"只读锁定"改为"登录态"用途：仅用于 (a) 提示文案"已登录，保存后会同步到云端"，(b) 触发保存时上传。（可考虑把 prop 改名 `isLoggedIn`/`syncOnSave`。）
- [x] **保存即上传**
  - `SettingsModal.handleSave` / `SimulationConfigModal.handleSave`：本地 `setConfig` 后，若已登录则 `pushLlmConfig(pickSyncedConfig(nextConfig))`；失败 → 非阻塞提示（本地已保存）。
  - 接线方式：由 `SidePanel`（持有 `useAdminWebAuth`）向两个弹窗传入 `pushConfig`/`onSavedSync` 回调，避免弹窗深依赖 service。
- [x] **下拉改为仅登录时**
  - `SidePanel.tsx:1113-1130`：删除聚焦/可见性 `refreshConfig` effect。
  - `useAdminWebAuth.ts` 启动 effect：保留 `getSession` 校验 token，**移除**启动时的 `syncConfigDown`；`syncConfigDown` 仅保留在 `login` 流程调用。（`refreshConfig` 若无其他用途可移除导出。）
- [x] **保留的地基**（确认无需改动即可）：`pickSyncedConfig` / `SYNCED_LLM_CONFIG_KEYS`（storage）；SidePanel 开关解锁。

### Admin Web 侧

- [x] **配置表单就地只读**
  - `extension-config-form.tsx`：所有 input/textarea + studentProfiles textarea 设 `disabled`/`readOnly`；移除"保存"按钮与 `onSubmit`→`saveMyLlmConfig` 调用；顶部加提示"配置请在插件中修改，此处仅供查看"。
- [x] **清理死代码**：Web 不再保存后，cookie-auth 的 `saveMyLlmConfig` server function 变为未用，顺手删除（`pnpm knip` 可核）。**保留** bearer `POST /api/extension/config`（插件推送用）。

### 门禁

- 扩展：`pnpm -F @extension/sidepanel type-check && lint`；`pnpm -F @extension/storage type-check && lint`。
- Admin Web：`cd admin_web && pnpm exec tsc --noEmit`；`pnpm check`（折行告警非阻塞）。
- 人工冒烟：登出编辑 → 登录（空账号播种/已有账号覆盖）→ 登录态改配置保存 → 关代理模拟推送失败看提示 → 换设备/重登拉取 → Web 查看只读。

---

## 明确不做（范围边界）

- 不动历史同步与 Web 历史页（已满足）。
- 不扩大同步字段集（TTS/采样/开关/选中档位仍本地）。
- 不引入配置时间戳/强一致合并（单用户 LWW 足够）。
- 不改 polymas 路径、生成的 `manifest.json`、`routeTree.gen.ts`。
