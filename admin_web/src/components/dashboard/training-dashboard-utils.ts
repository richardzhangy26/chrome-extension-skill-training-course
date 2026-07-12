import type { AgentLogSessionInput } from '@/lib/agent-log-schema';
import { buildTrainingMetaSummary, getSessionName } from '@/lib/extension-history-filename';

const DEFAULT_RECENT_LIMIT = 5;
const DEFAULT_DAILY_RANGE = 90;

interface TrainingDashboardSummary {
  todaySessions: number;
  todayEntries: number;
  todayTaskCount: number;
  totalSessions: number;
  totalEntries: number;
  totalTaskCount: number;
  lastUpdatedAt: number | null;
}

interface TrainingDailyStat {
  date: string;
  label: string;
  sessions: number;
  entries: number;
  taskCount: number;
}

interface TrainingTaskStat {
  taskId: string;
  taskName: string;
  metaSummary: string;
  sessions: number;
  entries: number;
  lastUpdatedAt: number;
}

interface TrainingRecentSession {
  id: string;
  taskId: string;
  name: string;
  metaSummary: string;
  entries: number;
  updatedAt: number;
}

interface TrainingDashboardView {
  summary: TrainingDashboardSummary;
  dailyStats: TrainingDailyStat[];
  taskStats: TrainingTaskStat[];
  recentSessions: TrainingRecentSession[];
}

const pad = (value: number) => value.toString().padStart(2, '0');

const startOfLocalDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const formatDateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const formatDayLabel = (date: Date) => `${date.getMonth() + 1}/${date.getDate()}`;

const buildDailyStats = (sessions: AgentLogSessionInput[], now: Date, days: number): TrainingDailyStat[] => {
  const today = startOfLocalDay(now);
  const firstDay = addDays(today, -(days - 1));
  const dailyMap = new Map<string, TrainingDailyStat & { taskIds: Set<string> }>();

  for (let index = 0; index < days; index += 1) {
    const day = addDays(firstDay, index);
    const date = formatDateKey(day);
    dailyMap.set(date, {
      date,
      label: formatDayLabel(day),
      sessions: 0,
      entries: 0,
      taskCount: 0,
      taskIds: new Set<string>(),
    });
  }

  for (const session of sessions) {
    const date = formatDateKey(new Date(session.updatedAt));
    const stat = dailyMap.get(date);
    if (!stat) {
      continue;
    }
    stat.sessions += 1;
    stat.entries += session.entries.length;
    stat.taskIds.add(session.taskId);
  }

  return [...dailyMap.values()].map(({ taskIds, ...stat }) => ({
    ...stat,
    taskCount: taskIds.size,
  }));
};

const buildSummary = (sessions: AgentLogSessionInput[], now: Date): TrainingDashboardSummary => {
  const todayStart = startOfLocalDay(now).getTime();
  const tomorrowStart = addDays(startOfLocalDay(now), 1).getTime();
  const todaySessions = sessions.filter(
    session => session.updatedAt >= todayStart && session.updatedAt < tomorrowStart,
  );

  return {
    todaySessions: todaySessions.length,
    todayEntries: todaySessions.reduce((total, session) => total + session.entries.length, 0),
    todayTaskCount: new Set(todaySessions.map(session => session.taskId)).size,
    totalSessions: sessions.length,
    totalEntries: sessions.reduce((total, session) => total + session.entries.length, 0),
    totalTaskCount: new Set(sessions.map(session => session.taskId)).size,
    lastUpdatedAt: sessions.length > 0 ? Math.max(...sessions.map(session => session.updatedAt)) : null,
  };
};

const buildTaskStats = (sessions: AgentLogSessionInput[]): TrainingTaskStat[] => {
  const taskMap = new Map<string, TrainingTaskStat>();

  for (const session of sessions) {
    const current = taskMap.get(session.taskId);
    if (!current) {
      taskMap.set(session.taskId, {
        taskId: session.taskId,
        taskName: getSessionName(session),
        metaSummary: buildTrainingMetaSummary(session),
        sessions: 1,
        entries: session.entries.length,
        lastUpdatedAt: session.updatedAt,
      });
      continue;
    }

    current.sessions += 1;
    current.entries += session.entries.length;
    if (session.updatedAt > current.lastUpdatedAt) {
      current.taskName = getSessionName(session);
      current.metaSummary = buildTrainingMetaSummary(session);
      current.lastUpdatedAt = session.updatedAt;
    }
  }

  return [...taskMap.values()].sort(
    (a, b) => b.sessions - a.sessions || b.entries - a.entries || b.lastUpdatedAt - a.lastUpdatedAt,
  );
};

const buildRecentSessions = (sessions: AgentLogSessionInput[], limit: number): TrainingRecentSession[] =>
  [...sessions]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit)
    .map(session => ({
      id: session.id,
      taskId: session.taskId,
      name: getSessionName(session),
      metaSummary: buildTrainingMetaSummary(session),
      entries: session.entries.length,
      updatedAt: session.updatedAt,
    }));

const buildTrainingDashboardView = (sessions: AgentLogSessionInput[], now = new Date()): TrainingDashboardView => ({
  summary: buildSummary(sessions, now),
  dailyStats: buildDailyStats(sessions, now, DEFAULT_DAILY_RANGE),
  taskStats: buildTaskStats(sessions),
  recentSessions: buildRecentSessions(sessions, DEFAULT_RECENT_LIMIT),
});

export { buildTrainingDashboardView };
export type {
  TrainingDailyStat,
  TrainingDashboardSummary,
  TrainingDashboardView,
  TrainingRecentSession,
  TrainingTaskStat,
};
