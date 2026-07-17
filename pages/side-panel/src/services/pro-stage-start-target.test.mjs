import assert from 'node:assert/strict';
import test from 'node:test';
import { createProStageStartTarget } from './pro-stage-start-target.ts';

test('未请求目标时服从服务端，请求目标只替换一次', () => {
  const target = createProStageStartTarget();
  assert.deepEqual(target.consume('server-1'), { stepId: 'server-1', overrodeServer: false });

  target.request('target-2');
  assert.equal(target.peek(), 'target-2');
  assert.deepEqual(target.consume('server-1'), { stepId: 'target-2', overrodeServer: true });
  assert.equal(target.peek(), null);
  assert.deepEqual(target.consume('server-3'), { stepId: 'server-3', overrodeServer: false });
});

test('目标等于服务端建议时消费目标但不标记 override，clear 可取消', () => {
  const target = createProStageStartTarget();
  target.request('s1');
  assert.deepEqual(target.consume('s1'), { stepId: 's1', overrodeServer: false });
  target.request('s2');
  target.clear();
  assert.deepEqual(target.consume('s1'), { stepId: 's1', overrodeServer: false });
});
