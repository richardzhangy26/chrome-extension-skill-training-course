import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { URL } from 'node:url';

test('Pro start 强制刷新用户，失败路径 invalidate', async () => {
  const source = await readFile(new URL('./useProAgentChat.ts', import.meta.url), 'utf8');

  assert.match(source, /refreshPolymasUserInfo\(\)/);
  assert.match(source, /invalidatePolymasUserInfo\(\)/);
});
