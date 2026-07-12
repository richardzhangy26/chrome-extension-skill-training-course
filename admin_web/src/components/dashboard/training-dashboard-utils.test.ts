import assert from 'node:assert/strict';
import type { AgentLogSessionInput } from '@/lib/agent-log-schema';
import { buildTrainingDashboardView } from './training-dashboard-utils';

const time = (value: string) => new Date(value).getTime();

const session = (
  overrides: Partial<AgentLogSessionInput> & Pick<AgentLogSessionInput, 'id'>,
): AgentLogSessionInput => ({
  taskId: 'task-alpha',
  createdAt: time('2026-07-01T09:00:00+08:00'),
  updatedAt: time('2026-07-01T09:00:00+08:00'),
  entries: [],
  ...overrides,
});

const entry = (timestamp: number): AgentLogSessionInput['entries'][number] => ({
  type: 'chat',
  timestamp,
  stepId: 'step-1',
  stepName: '开场',
  round: 1,
  source: 'chat',
  userText: '老师提问',
  aiText: '学生回答',
});

const todayMorning = time('2026-07-08T10:00:00+08:00');
const todayNoon = time('2026-07-08T11:30:00+08:00');
const yesterday = time('2026-07-07T16:00:00+08:00');

const sessions: AgentLogSessionInput[] = [
  session({
    id: 's1',
    taskId: 'task-alpha',
    taskName: '问候训练',
    updatedAt: todayMorning,
    trainingMeta: { schoolName: '第一小学', courseName: '英语' },
    entries: [entry(todayMorning), entry(todayMorning + 1000)],
  }),
  session({
    id: 's2',
    taskId: 'task-beta',
    taskName: '点餐训练',
    updatedAt: todayNoon,
    entries: [entry(todayNoon)],
  }),
  session({
    id: 's3',
    taskId: 'task-alpha',
    taskName: '问候训练',
    updatedAt: yesterday,
    entries: [entry(yesterday), entry(yesterday + 1000), entry(yesterday + 2000)],
  }),
];

const view = buildTrainingDashboardView(sessions, new Date('2026-07-08T12:00:00+08:00'));

assert.deepEqual(view.summary, {
  todaySessions: 2,
  todayEntries: 3,
  todayTaskCount: 2,
  totalSessions: 3,
  totalEntries: 6,
  totalTaskCount: 2,
  lastUpdatedAt: todayNoon,
});

assert.equal(view.dailyStats.length, 90);
assert.deepEqual(view.dailyStats.at(-1), {
  date: '2026-07-08',
  label: '7/8',
  sessions: 2,
  entries: 3,
  taskCount: 2,
});
assert.deepEqual(view.dailyStats.at(-2), {
  date: '2026-07-07',
  label: '7/7',
  sessions: 1,
  entries: 3,
  taskCount: 1,
});

assert.deepEqual(
  view.taskStats.map(task => ({
    taskId: task.taskId,
    taskName: task.taskName,
    sessions: task.sessions,
    entries: task.entries,
    lastUpdatedAt: task.lastUpdatedAt,
  })),
  [
    {
      taskId: 'task-alpha',
      taskName: '问候训练',
      sessions: 2,
      entries: 5,
      lastUpdatedAt: todayMorning,
    },
    {
      taskId: 'task-beta',
      taskName: '点餐训练',
      sessions: 1,
      entries: 1,
      lastUpdatedAt: todayNoon,
    },
  ],
);

assert.deepEqual(
  view.recentSessions.map(recent => recent.id),
  ['s2', 's1', 's3'],
);

assert.equal(view.recentSessions[1]?.metaSummary, '第一小学 · 英语');
