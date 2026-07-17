import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAgentLogText, getHistoryAiRoleName } from './history-log-format.ts';

const session = {
  id: 'log-1',
  taskId: 'PRO123',
  taskName: 'Pro 任务',
  createdAt: 1,
  updatedAt: 2,
  entries: [
    { type: 'chat', timestamp: 2, stepId: 's1', stepName: '阶段一', round: 1, source: 'chat', userText: '你好' },
    {
      type: 'chat',
      timestamp: 3,
      stepId: 's1',
      stepName: '阶段一',
      round: 1,
      source: 'chat',
      aiText: '欢迎',
      aiRoleName: '小研',
    },
    { type: 'chat', timestamp: 4, stepId: 's1', stepName: '阶段一', round: 1, source: 'chat', aiText: '普通回答' },
  ],
};

test('Pro 使用 aiRoleName，普通条目回退 AI', () => {
  assert.equal(getHistoryAiRoleName(session.entries[1]), '小研');
  assert.equal(getHistoryAiRoleName(session.entries[2]), 'AI');
  const text = buildAgentLogText(session, value => `time:${value}`);
  assert.match(text, /用户: 你好/);
  assert.match(text, /小研: 欢迎/);
  assert.match(text, /AI: 普通回答/);
  assert.doesNotMatch(text, /AI: 小研:/);
});
