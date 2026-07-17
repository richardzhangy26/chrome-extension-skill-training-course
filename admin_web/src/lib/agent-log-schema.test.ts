import assert from 'node:assert/strict';
import { agentLogSessionSchema } from './agent-log-schema';

const baseEntry = {
  type: 'chat' as const,
  timestamp: 1,
  stepId: 's1',
  round: 1,
  source: 'chat' as const,
  aiText: '你好',
};

const parse = (entry: typeof baseEntry & { aiRoleName?: string }) =>
  agentLogSessionSchema.parse({
    id: 'log-1',
    taskId: 'PRO123',
    createdAt: 1,
    updatedAt: 2,
    entries: [entry],
  });

assert.equal(parse({ ...baseEntry, aiRoleName: '小研' }).entries[0].aiRoleName, '小研');
assert.equal(parse(baseEntry).entries[0].aiRoleName, undefined);
