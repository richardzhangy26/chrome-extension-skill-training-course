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
