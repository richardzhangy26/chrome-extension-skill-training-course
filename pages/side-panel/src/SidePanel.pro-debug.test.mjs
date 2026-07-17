import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { URL } from 'node:url';

test('Pro ChatInput 显示调试入口并打开共用弹窗', async () => {
  const source = await readFile(new URL('./SidePanel.tsx', import.meta.url), 'utf8');
  assert.match(source, /<ProChatArea[\s\S]*?onOpenDebug=\{\(\) => setIsDebugOpen\(true\)\}/);
  assert.match(source, /showDebug=\{true\}/);
  assert.match(source, /mode === 'pro'[\s\S]*?pro\.refreshDebugStages\(\)/);
});

test('选择步骤按当前模式分流，Pro 使用 restartAtStage', async () => {
  const source = await readFile(new URL('./SidePanel.tsx', import.meta.url), 'utf8');
  assert.match(source, /if \(mode === 'pro'\)[\s\S]*?pro\.restartAtStage\(stepId\)/);
  assert.match(source, /variant=\{mode === 'pro' \? 'pro' : 'standard'\}/);
});
