import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { URL } from 'node:url';

test('Pro 定向启动在 teardown 后请求目标，并只在 nextStep 消费一次', async () => {
  const source = await readFile(new URL('./useProAgentChat.ts', import.meta.url), 'utf8');
  assert.match(source, /const restartAtStage = useCallback[\s\S]*?teardown\(\)[\s\S]*?beginRun\(stage\)/);
  assert.match(source, /stageStartTargetRef\.current\.request\(requestedStage\.stepId\)/);
  assert.match(source, /stageStartTargetRef\.current\.consume\(payload\.nextStepId\)/);
  assert.match(source, /selection\.overrodeServer[\s\S]*?runStageEntry\(seq\)/);
});

test('teardown、reset 与任务变化路径都会清除未消费目标', async () => {
  const source = await readFile(new URL('./useProAgentChat.ts', import.meta.url), 'utf8');
  assert.match(source, /const teardown = useCallback\(\(\) => \{[\s\S]*?stageStartTargetRef\.current\.clear\(\)/);
  assert.match(source, /taskChangeTracker\.update\(trainTaskId\)[\s\S]*?reset\(\)/);
  assert.match(source, /组件卸载时断开连接[\s\S]*?stageStartTarget\.clear\(\)/);
});

test('阶段列表刷新仅允许最新、同任务且仍挂载的请求写入状态', async () => {
  const source = await readFile(new URL('./useProAgentChat.ts', import.meta.url), 'utf8');
  assert.match(source, /const stageRefreshSeqRef = useRef\(0\)/);
  assert.match(source, /const isMountedRef = useRef\(true\)/);
  assert.match(source, /const requestedTaskId = trainTaskId/);
  assert.match(
    source,
    /stageRefreshSeqRef\.current === requestSeq[\s\S]*?trainTaskIdRef\.current === requestedTaskId[\s\S]*?isMountedRef\.current/,
  );
  assert.match(source, /finally \{[\s\S]*?if \(isCurrentRequest\(\)\)[\s\S]*?setIsStageListLoading\(false\)/);
  assert.match(source, /const teardown = useCallback\(\(\) => \{[\s\S]*?stageRefreshSeqRef\.current \+= 1/);
  assert.match(
    source,
    /组件卸载时断开连接[\s\S]*?isMountedRef\.current = false[\s\S]*?stageRefreshSeqRef\.current \+= 1/,
  );
});
