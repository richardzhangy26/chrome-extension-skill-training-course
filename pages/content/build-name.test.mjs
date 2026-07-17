import assert from 'node:assert/strict';
import test from 'node:test';

import { toIifeGlobalName } from './build-name.ts';

test('Pro content entry 名称会转换为合法且稳定的 IIFE global name', () => {
  assert.equal(toIifeGlobalName('pro-train-v2-relay'), 'contentScript_pro_train_v2_relay');
  assert.equal(toIifeGlobalName('pro-train-v2-main'), 'contentScript_pro_train_v2_main');
  assert.equal(toIifeGlobalName('pro-train-v2-relay'), 'contentScript_pro_train_v2_relay');
});

test('已经合法的 JavaScript 标识符保持不变', () => {
  assert.equal(toIifeGlobalName('example'), 'example');
  assert.equal(toIifeGlobalName('$content_script2'), '$content_script2');
});

test('数字开头、非法字符和保留字都会转换为合法标识符', () => {
  assert.equal(toIifeGlobalName('123-training.entry'), 'contentScript_123_training_entry');
  assert.equal(toIifeGlobalName('voice/训练'), 'contentScript_voice___');
  assert.equal(toIifeGlobalName('class'), 'contentScript_class');
});
