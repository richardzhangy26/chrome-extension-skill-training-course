# 支持 OpenRouter 等第三方 OpenAI-格式 API 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让插件文本模型配置能对接 OpenRouter 等标准 OpenAI-格式第三方 API，并让现有"刷新模型列表"链路对其可用。

**Architecture:** 认证头"双发"——对同一个 `apiKey` 同时发送 `api-key`（Polymas/Azure 读）与 `Authorization: Bearer`（OpenAI/OpenRouter 读），两类后端各读各的、互相忽略。仅改插件 `services/llm-service.ts` 的纯函数与一处文案，**不新增字段、不动云端 schema / D1 / admin_web / 7-字段同步集**。

**Tech Stack:** TypeScript + React（`@extension/sidepanel` workspace）；测试用 Node 内建 `node:test` + 源码检查（沿用本仓 `SidePanel.idle-controls.test.mjs` 约定）。

## Global Constraints

- 仅改动 `pages/side-panel/` 下文件；**不得**触及 `admin_web/`、`packages/storage/`、`llm-config-schema`、D1、`SYNCED_LLM_CONFIG_KEYS`。
- `api-key` 头的值保持 `config.apiKey` 原样，不改变既有 Polymas 行为；`Authorization` 值同样用 `config.apiKey`（不 trim，与 `api-key` 一致）。
- 只在 `config.apiKey.trim()` 非空时才发送认证头（保持现有条件）。
- 不动语音 / TTS 链路（`ttsApiUrl`）。
- 测试沿用 `node:test` + `readFileSync` 源码检查风格；测试文件为 `.mjs`，结构镜像 `pages/side-panel/src/SidePanel.idle-controls.test.mjs`（顶部 import、`test('...', () => {...})`、无 export）。
- 遵循本仓 ESLint 严格规则（箭头函数、export 置尾等）。

---

### Task 1: 认证头双发 + `fetchAvailableTextModels` 复用 builder

**Files:**
- Test: `pages/side-panel/src/services/llm-service.headers.test.mjs`（Create）
- Modify: `pages/side-panel/src/services/llm-service.ts`（`buildTextModelHeaders` 约 256-260 行；`fetchAvailableTextModels` 请求头约 773-780 行）

**Interfaces:**
- Consumes: 无（依赖现有 `buildTextModelHeaders`、`fetchAvailableTextModels`、`resolveModelsUrl`）。
- Produces: `buildTextModelHeaders(config)` 现在返回同时含 `'api-key'` 与 `Authorization: Bearer …` 的 header 对象；`callChatCompletion` / `testLLMConfig`（已调用它）自动获得双发；`fetchAvailableTextModels` 改为复用它。

- [ ] **Step 1: 写失败测试**

创建 `pages/side-panel/src/services/llm-service.headers.test.mjs`：

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';

const source = readFileSync(new URL('./llm-service.ts', import.meta.url), 'utf8');

const builder = source.match(/const buildTextModelHeaders =[\s\S]*?\n\}\);/);
const fetchModels = source.match(/const fetchAvailableTextModels = async \([\s\S]*?\n\};/);

test('buildTextModelHeaders 同时下发 api-key 与 Authorization: Bearer', () => {
  assert.ok(builder, '应能定位 buildTextModelHeaders 定义');
  assert.match(builder[0], /['"]api-key['"]/, '应保留 Polymas/Azure 的 api-key 头');
  assert.match(builder[0], /Authorization/, '应新增 Authorization 头');
  assert.match(builder[0], /Bearer \$\{config\.apiKey\}/, 'Authorization 应为 Bearer + apiKey');
});

test('fetchAvailableTextModels 复用 buildTextModelHeaders，不再内联 api-key 头', () => {
  assert.ok(fetchModels, '应能定位 fetchAvailableTextModels 定义');
  assert.match(fetchModels[0], /headers: buildTextModelHeaders\(config\)/, '模型列表请求应复用 header builder');
  assert.doesNotMatch(fetchModels[0], /['"]api-key['"]/, 'fetchAvailableTextModels 内部不应再手写 api-key 头');
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /Users/zhangyichi/github/chrome-extension-skill-training-course && node --test pages/side-panel/src/services/llm-service.headers.test.mjs`
Expected: FAIL —— 两个用例均失败（当前 `builder[0]` 无 `Authorization`；`fetchModels[0]` 仍含内联 `'api-key'`、无 `buildTextModelHeaders(config)`）。

- [ ] **Step 3: 改 `buildTextModelHeaders` 双发**

在 `pages/side-panel/src/services/llm-service.ts` 把（约 256-260 行）：

```ts
const buildTextModelHeaders = (config: Pick<LLMConfig, 'apiKey' | 'serviceCode'>) => ({
  'Content-Type': 'application/json',
  ...(config.apiKey.trim() ? { 'api-key': config.apiKey } : {}),
  ...(config.serviceCode.trim() ? { 'service-code': config.serviceCode } : {}),
});
```

改为：

```ts
const buildTextModelHeaders = (config: Pick<LLMConfig, 'apiKey' | 'serviceCode'>) => ({
  'Content-Type': 'application/json',
  ...(config.apiKey.trim() ? { 'api-key': config.apiKey, Authorization: `Bearer ${config.apiKey}` } : {}),
  ...(config.serviceCode.trim() ? { 'service-code': config.serviceCode } : {}),
});
```

- [ ] **Step 4: 让 `fetchAvailableTextModels` 复用 builder**

在同文件把（约 773-780 行）：

```ts
  await assertHostPermission(modelsUrl);
  const response = await fetch(modelsUrl, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey.trim() ? { 'api-key': config.apiKey } : {}),
      ...(config.serviceCode.trim() ? { 'service-code': config.serviceCode } : {}),
    },
  });
```

改为：

```ts
  await assertHostPermission(modelsUrl);
  const response = await fetch(modelsUrl, {
    method: 'GET',
    headers: buildTextModelHeaders(config),
  });
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd /Users/zhangyichi/github/chrome-extension-skill-training-course && node --test pages/side-panel/src/services/llm-service.headers.test.mjs`
Expected: PASS —— 2 passing。

- [ ] **Step 6: 类型检查与 lint**

Run: `cd /Users/zhangyichi/github/chrome-extension-skill-training-course && pnpm -F @extension/sidepanel type-check && pnpm -F @extension/sidepanel lint`
Expected: 均通过、无 error。

- [ ] **Step 7: 提交**

```bash
cd /Users/zhangyichi/github/chrome-extension-skill-training-course
git add pages/side-panel/src/services/llm-service.ts pages/side-panel/src/services/llm-service.headers.test.mjs
git commit -m "feat(llm): dual auth header (api-key + Bearer) for OpenAI-compatible APIs"
```

---

### Task 2: API Key 文案中性化

**Files:**
- Test: `pages/side-panel/src/components/SettingsModal.copy.test.mjs`（Create）
- Modify: `pages/side-panel/src/components/SettingsModal.tsx:408,411`

**Interfaces:**
- Consumes: 无。
- Produces: 无（纯 UI 文案；仅供人工与回归测试观测）。

- [ ] **Step 1: 写失败测试**

创建 `pages/side-panel/src/components/SettingsModal.copy.test.mjs`：

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';

const source = readFileSync(new URL('./SettingsModal.tsx', import.meta.url), 'utf8');

test('API Key 文案中性化，去除 Polymas 专属措辞', () => {
  assert.doesNotMatch(source, /请输入豆包 API Key/, '不应再出现"豆包"专属 placeholder');
  assert.doesNotMatch(source, /需要企业微信申请 llm-service 获取/, '不应再出现企业微信专属提示');
  assert.match(source, /OpenRouter/, '应提示支持 OpenRouter 等 OpenAI 格式服务');
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /Users/zhangyichi/github/chrome-extension-skill-training-course && node --test pages/side-panel/src/components/SettingsModal.copy.test.mjs`
Expected: FAIL —— `请输入豆包 API Key` / `需要企业微信申请 llm-service 获取` 仍在、且无 `OpenRouter`。

- [ ] **Step 3: 改文案**

在 `pages/side-panel/src/components/SettingsModal.tsx`：

第 408 行：

```tsx
                    placeholder="请输入豆包 API Key"
```

改为：

```tsx
                    placeholder="请输入 API Key"
```

第 411 行：

```tsx
                  <p className="mt-1 text-xs text-slate-400">需要企业微信申请 llm-service 获取</p>
```

改为：

```tsx
                  <p className="mt-1 text-xs text-slate-400">
                    支持 OpenRouter、OpenAI 等标准 OpenAI 格式服务；Polymas 用户可填企业微信申请的 llm-service Key
                  </p>
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd /Users/zhangyichi/github/chrome-extension-skill-training-course && node --test pages/side-panel/src/components/SettingsModal.copy.test.mjs`
Expected: PASS —— 1 passing。

- [ ] **Step 5: 类型检查与 lint**

Run: `cd /Users/zhangyichi/github/chrome-extension-skill-training-course && pnpm -F @extension/sidepanel type-check && pnpm -F @extension/sidepanel lint`
Expected: 均通过、无 error。

- [ ] **Step 6: 提交**

```bash
cd /Users/zhangyichi/github/chrome-extension-skill-training-course
git add pages/side-panel/src/components/SettingsModal.tsx pages/side-panel/src/components/SettingsModal.copy.test.mjs
git commit -m "chore(ui): neutralize API Key copy for third-party OpenAI-compatible APIs"
```

---

## 手动端到端验证（两任务完成后一次性执行）

1. `pnpm dev` 构建插件，`chrome://extensions` 从 `dist/` 加载。
2. 侧栏设置 → LLM 标签页：`API URL = https://openrouter.ai/api/v1/chat/completions`、`API Key = sk-or-...`。
3. 点"授权当前 API 域名" → 授权 `openrouter.ai`。
4. 点"测试连接" → 应 ✅ 成功。
5. 点"刷新模型列表" → 下拉框应出现 OpenRouter 文本模型（数量 > 默认候选）。
6. 选一个模型 → 保存 → 发一条消息 → 应正常返回。
7. 回归：切回 Polymas 配置 → 测试连接 / 刷新模型列表 / 对话仍正常。

## Self-Review 记录

- **Spec 覆盖**：认证双发（Task 1）✓；`fetchAvailableTextModels` 复用（Task 1 Step 4）✓；文案中性化（Task 2）✓；不做项（TTS / model-brand / 选择器）—— 计划未触及，符合 ✓；测试沿用 `node:test` 源码检查 ✓。
- **占位符扫描**：无 TBD/TODO；文案与代码均为可直接落地的完整内容。
- **类型一致性**：`buildTextModelHeaders` / `fetchAvailableTextModels` / `config.apiKey` 命名跨任务一致；测试正则与实现字面量一致（`Bearer ${config.apiKey}`、`headers: buildTextModelHeaders(config)`）。
