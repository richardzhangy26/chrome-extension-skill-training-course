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
