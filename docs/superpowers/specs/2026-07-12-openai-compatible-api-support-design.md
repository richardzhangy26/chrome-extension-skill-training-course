# 支持 OpenRouter 等第三方 OpenAI-格式 API — 设计文档

- 日期：2026-07-12
- 范围：`pages/side-panel`（插件文本模型配置）
- 目标读者：后续实现该功能的开发者 / Agent

## 一、背景与目标

用户希望文本模型配置能对接 **OpenRouter 等标准 OpenAI-格式第三方 API**，并且配置完成后能通过 fetch **查看该 API 可用的模型列表**。

调研发现：**"查看模型列表"这条链路已经完整存在**（见下），当前唯一的功能性缺口是 **认证请求头方案**。

### 现状盘点（已实现，无需重做）

| 能力 | 位置 | 状态 |
| --- | --- | --- |
| 自定义 API URL / API Key / 模型名（自由文本输入） | `components/SettingsModal.tsx` LLM 标签页 | ✅ |
| "刷新模型列表"按钮 + 动态拉取 | `SettingsModal.tsx` → `fetchAvailableTextModels()` | ✅ |
| 从 `/chat/completions` 推导 `/models` 地址（兼容 `/v1` 路径） | `services/llm-service.ts` → `resolveModelsUrl()` | ✅ |
| 模型下拉框（按品牌分组、仅显示文本模型） | `components/ModelSelector.tsx` + `isTextModel()` 过滤 | ✅ |

`resolveModelsUrl()` 已能把 `https://openrouter.ai/api/v1/chat/completions` 正确解析为 `https://openrouter.ai/api/v1/models`，因此 OpenRouter 的 URL 无需特殊处理。

### 核心缺口：认证头

当前文本模型请求头写死为 **Polymas / Azure 风格**（`services/llm-service.ts` 的 `buildTextModelHeaders`）：

```
api-key: <apiKey>
service-code: SI_Ability
```

而 **OpenRouter / OpenAI 及绝大多数标准 OpenAI-格式第三方 API** 要求：

```
Authorization: Bearer <apiKey>
```

所以当前配置 OpenRouter 时，聊天请求会返回 **401**（OpenRouter 的 `/models` 是公开接口，可能碰巧拉得到列表，但对话必失败）。

## 二、方案：认证头"双发"

对同一个 `apiKey`，请求头 **同时发送** `api-key`（Polymas/Azure 读）和 `Authorization: Bearer`（OpenAI/OpenRouter 读）。两类服务端各读各的、互相忽略对方不认识的头。

选择该方案（相对"新增认证方式选择器""按 URL 判断"）的理由：

- **零新增字段** → 不动 `admin_web/src/lib/llm-config-schema.ts`、不动 D1、不动 admin_web 只读展示页、不动 7-字段同步集（`SYNCED_LLM_CONFIG_KEYS`）。**零跨-workspace 改动**。
- 符合 KISS：一个纯函数改动即可让两类后端同时可用，无需用户理解"认证方式"概念。

## 三、改动清单

### 1. `pages/side-panel/src/services/llm-service.ts`（核心）

**a. `buildTextModelHeaders`**：在 `apiKey` 非空时，除 `api-key` 外追加 `Authorization: Bearer <apiKey>`。

```ts
const buildTextModelHeaders = (config: Pick<LLMConfig, 'apiKey' | 'serviceCode'>) => ({
  'Content-Type': 'application/json',
  ...(config.apiKey.trim() ? { 'api-key': config.apiKey, Authorization: `Bearer ${config.apiKey}` } : {}),
  ...(config.serviceCode.trim() ? { 'service-code': config.serviceCode } : {}),
});
```

- `api-key` 的值维持原样（`config.apiKey`），不改变既有 Polymas 行为。
- `Bearer` 值同样用 `config.apiKey`，与 `api-key` 保持一致。

**b. `fetchAvailableTextModels`**：把内联的请求头（当前手写 `api-key` / `service-code`）改为复用 `buildTextModelHeaders(config)`。既消除重复，又让 `/models` 拉取对"需要鉴权的第三方 `/models` 接口"也走双发认证。

> 说明：`callChatCompletion`（聊天）与 `testLLMConfig`（测试连接）已经调用 `buildTextModelHeaders`，因此改 `buildTextModelHeaders` 即自动覆盖这两条路径。

### 2. `pages/side-panel/src/components/SettingsModal.tsx`（文案中性化）

LLM 标签页 API Key 输入框的 Polymas 专属文案改为中性提示，避免配第三方 API 时误导：

- placeholder `请输入豆包 API Key` → `请输入 API Key`
- 下方说明 `需要企业微信申请 llm-service 获取` → 中性文案，例如：`支持 OpenRouter、OpenAI 等标准 OpenAI 格式服务；Polymas 用户可填企业微信申请的 llm-service Key`

（最终措辞在实现时定稿，语义以"中性 + 保留 Polymas 说明"为准。）

## 四、明确不做（YAGNI / 超范围）

- **语音 / TTS 认证头**：另一条独立链路（`ttsApiUrl`），本次不动。
- **`model-brand.ts` 分组美化**：OpenRouter 的 `openai/gpt-4o` 这类带前缀 ID 最坏落入"其它"分组，不影响选择与调用，不处理。
- **"认证方式"选择器**：已选双发方案，不引入该概念。
- **OpenRouter 可选的 `HTTP-Referer` / `X-Title` 排名头**：非功能必需，不加。

## 五、风险与缓解

- **极少数严格网关** 可能因请求同时带 `api-key` 与 `Authorization` 而拒绝。
  - 缓解：现成的"测试连接"按钮会立刻暴露该问题；Polymas 为 Azure 风格、会忽略 `Authorization`，实际风险低。
- **CORS**：不涉及。文本模型请求是插件页面在 `host_permissions` 授权下的直连 `fetch`，扩展页绕过 CORS，自定义头不触发拦截（现有 Polymas 直连已验证可行）。

## 六、测试与验证

### 单元测试（沿用本仓约定）

本仓侧栏测试采用 Node 内建 `node:test` + 源码检查（`readFileSync` + 正则）风格（见 `pages/side-panel/src/SidePanel.idle-controls.test.mjs`）。新增 `pages/side-panel/src/services/llm-service.headers.test.mjs`：

1. 断言 `buildTextModelHeaders` 源码中同时产出 `api-key` 与 `Authorization` / `Bearer`。
2. 断言 `fetchAvailableTextModels` 复用 `buildTextModelHeaders`（其内部不再手写 `api-key` 内联头）。

运行：`node --test pages/side-panel/src/services/llm-service.headers.test.mjs`

### 静态检查

- `pnpm -F @extension/sidepanel type-check`
- `pnpm -F @extension/sidepanel lint`

### 手动验证（端到端）

1. 设置里填 OpenRouter：`apiUrl = https://openrouter.ai/api/v1/chat/completions`，`apiKey = sk-or-...`。
2. 点"测试连接" → 应成功。
3. 点"刷新模型列表" → 下拉框应出现 OpenRouter 文本模型。
4. 选一个模型 → 发一条消息 → 应正常返回。
5. 回归：Polymas 配置下"测试连接 / 对话 / 刷新模型列表"仍正常。
