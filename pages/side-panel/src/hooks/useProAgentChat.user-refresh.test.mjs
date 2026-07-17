import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { URL } from 'node:url';

test('Pro start 强制刷新用户，失败路径 invalidate', async () => {
  const source = await readFile(new URL('./useProAgentChat.ts', import.meta.url), 'utf8');

  assert.match(source, /refreshPolymasUserInfo\(\)/);
  assert.match(source, /invalidatePolymasUserInfo\(\)/);
});

test('trainTaskId 改变时 reset 会 teardown 旧 Pro 会话', async () => {
  const source = await readFile(new URL('./useProAgentChat.ts', import.meta.url), 'utf8');

  assert.match(source, /createProTaskChangeTracker\(trainTaskId\)/);
  assert.match(source, /taskChangeTracker\.update\(trainTaskId\)[\s\S]*?reset\(\)/);
  assert.match(source, /const reset = useCallback\(\(\) => \{\s*teardown\(\)/);
  assert.match(
    source,
    /const config = await llmConfigStorage\.get\(\);\s*if \(runSeqRef\.current !== seq\) \{\s*return;/,
  );
});
