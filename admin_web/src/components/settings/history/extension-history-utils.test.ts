import assert from 'node:assert/strict';
import type { AgentLogSessionInput } from '@/lib/agent-log-schema';
import {
  buildBulkHistoryZipEntries,
  getRecentPreviewEntries,
  getUniqueHistoryFilename,
} from './extension-history-utils';

const entry = (timestamp: number, label: string): AgentLogSessionInput['entries'][number] => ({
  type: 'chat',
  timestamp,
  stepId: `step-${label}`,
  stepName: `阶段 ${label}`,
  round: timestamp,
  source: 'chat',
  userText: `用户 ${label}`,
  aiText: `AI ${label}`,
});

const session = (id: string, taskName: string, entries: AgentLogSessionInput['entries']): AgentLogSessionInput => ({
  id,
  taskId: id,
  taskName,
  createdAt: 1000,
  updatedAt: 2000,
  entries,
});

const formatTime = (value: number) => `time:${value}`;
const buildText = (s: AgentLogSessionInput) => `txt:${s.id}`;

assert.deepEqual(
  getRecentPreviewEntries(
    session(
      's1',
      '训练一',
      [1, 2, 3, 4, 5, 6, 7].map(value => entry(value, String(value))),
    ),
    5,
  ).map(item => item.timestamp),
  [3, 4, 5, 6, 7],
);

assert.equal(getUniqueHistoryFilename('重复.txt', new Set()), '重复.txt');
assert.equal(getUniqueHistoryFilename('重复.txt', new Set(['重复.txt'])), '重复-2.txt');
assert.equal(getUniqueHistoryFilename('重复.txt', new Set(['重复.txt', '重复-2.txt'])), '重复-3.txt');
assert.equal(getUniqueHistoryFilename('无扩展名', new Set(['无扩展名'])), '无扩展名-2');

const duplicateA = session('a', '重复', [entry(1, 'a')]);
const duplicateB = session('b', '重复', [entry(2, 'b')]);
const zipEntries = buildBulkHistoryZipEntries([duplicateA, duplicateB], buildText, () => '重复.txt');

assert.deepEqual(zipEntries, {
  '重复.txt': 'txt:a',
  '重复-2.txt': 'txt:b',
});

assert.equal(formatTime(123), 'time:123');
