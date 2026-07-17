import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { URL } from 'node:url';

test('URL 监听不再只接受 trainTaskId 字面量', async () => {
  const source = await readFile(new URL('./useAgentChat.ts', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /url\.includes\('trainTaskId='\)/);
  assert.match(source, /extractTrainTaskId\(url\)/);
});
