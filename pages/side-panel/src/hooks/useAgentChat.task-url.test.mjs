import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { URL } from 'node:url';

test('URL 监听不再只接受 trainTaskId 字面量', async () => {
  const source = await readFile(new URL('./useAgentChat.ts', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /url\.includes\('trainTaskId='\)/);
  assert.match(source, /extractTrainTaskId\(url\)/);
});

test('初始化与 URL listener 共用 latest task controller 和当前 task ref', async () => {
  const source = await readFile(new URL('./useAgentChat.ts', import.meta.url), 'utf8');

  assert.match(source, /createLatestTaskSwitchController/);
  assert.match(source, /getCurrentTaskId: \(\) => trainTaskIdRef\.current/);
  assert.match(source, /initialize\(taskSwitchController\)/);
  assert.match(source, /taskSwitchController\.switchTask\(\{ kind: 'url-change', url \}\)/);
});

test('task controller 不因 addMessage 随步骤变化而重建', async () => {
  const source = await readFile(new URL('./useAgentChat.ts', import.meta.url), 'utf8');

  assert.match(source, /const addMessageRef = useRef\(addMessage\)/);
  assert.match(source, /const taskSwitchControllerRef = useRef<TaskSwitchController \| null>\(null\)/);
  assert.match(
    source,
    /const applyTaskSwitch = useCallback\([\s\S]*?addMessageRef\.current\('system', message\);[\s\S]*?}, \[\]\);/,
  );
});
