/**
 * 智能体日志存储
 */

import { authSessionStorage } from './auth-session-storage.js';
import { createStorage, StorageEnum } from '../base/index.js';
import type { BaseStorageType } from '../base/index.js';

type AgentLogEntryType = 'chat';
type AgentLogSource = 'runCard' | 'chat';

interface ChatLogEntry {
  type: 'chat';
  timestamp: number;
  stepId: string;
  stepName?: string;
  round: number;
  source: AgentLogSource;
  userText?: string;
  aiText?: string;
  aiRoleName?: string;
}

type AgentLogEntry = ChatLogEntry;

interface AgentLogSession {
  id: string;
  taskId: string;
  taskName?: string;
  trainingMeta?: AgentTrainingMeta;
  createdAt: number;
  updatedAt: number;
  stepNameMapping?: Record<string, string>;
  entries: AgentLogEntry[];
  ownerUserId?: string;
}

interface AgentTrainingMeta {
  courseId?: string;
  courseName?: string;
  schoolName?: string;
  regionName?: string;
  agentName?: string;
}

const STORAGE_KEY_AGENT_LOGS = 'agent-log-sessions';

const DEFAULT_SESSIONS: AgentLogSession[] = [];

const storage = createStorage<AgentLogSession[]>(STORAGE_KEY_AGENT_LOGS, DEFAULT_SESSIONS, {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});

interface AgentLogStorageType extends BaseStorageType<AgentLogSession[]> {
  createSession: (payload: {
    taskId: string;
    taskName?: string;
    trainingMeta?: AgentTrainingMeta;
    stepNameMapping?: Record<string, string>;
  }) => Promise<AgentLogSession>;
  addEntry: (sessionId: string, entry: AgentLogEntry) => Promise<void>;
  updateStepNameMapping: (sessionId: string, mapping: Record<string, string>) => Promise<void>;
  updateSessionName: (sessionId: string, taskName?: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  clearSessions: () => Promise<void>;
  getSessionById: (sessionId: string) => Promise<AgentLogSession | null>;
}

const generateSessionId = (): string => `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

const mergeStepNameMapping = (
  current: Record<string, string> | undefined,
  next: Record<string, string>,
): Record<string, string> => ({ ...(current ?? {}), ...next });

const agentLogStorage: AgentLogStorageType = {
  ...storage,

  createSession: async ({ taskId, taskName, trainingMeta, stepNameMapping }) => {
    const now = Date.now();
    const auth = await authSessionStorage.get();
    const session: AgentLogSession = {
      id: generateSessionId(),
      taskId,
      taskName,
      ...(trainingMeta ? { trainingMeta } : {}),
      createdAt: now,
      updatedAt: now,
      stepNameMapping,
      entries: [],
      ...(auth.isLoggedIn && auth.user ? { ownerUserId: auth.user.id } : {}),
    };

    await storage.set(current => [...current, session]);
    return session;
  },

  addEntry: async (sessionId, entry) => {
    await storage.set(current =>
      current.map(session =>
        session.id === sessionId
          ? {
              ...session,
              entries: [...session.entries, entry],
              updatedAt: Date.now(),
            }
          : session,
      ),
    );
  },

  updateStepNameMapping: async (sessionId, mapping) => {
    await storage.set(current =>
      current.map(session =>
        session.id === sessionId
          ? {
              ...session,
              stepNameMapping: mergeStepNameMapping(session.stepNameMapping, mapping),
              updatedAt: Date.now(),
            }
          : session,
      ),
    );
  },

  updateSessionName: async (sessionId, taskName) => {
    const normalizedName = taskName?.trim();
    await storage.set(current =>
      current.map(session =>
        session.id === sessionId
          ? {
              ...session,
              taskName: normalizedName?.length ? normalizedName : undefined,
              updatedAt: Date.now(),
            }
          : session,
      ),
    );
  },

  deleteSession: async sessionId => {
    await storage.set(current => current.filter(session => session.id !== sessionId));
  },

  clearSessions: async () => {
    await storage.set([]);
  },

  getSessionById: async sessionId => {
    const sessions = await storage.get();
    return sessions.find(session => session.id === sessionId) ?? null;
  },
};

/**
 * 按当前登录用户过滤可见 session：
 * - 登录态：显示本人(ownerUserId===currentUserId) + 匿名(未设 ownerUserId，待迁移)；
 * - 登出态：仅显示匿名。
 * 同一 Chrome profile 下不显示其他用户的历史（用户隔离）。
 */
const selectVisibleSessions = (sessions: AgentLogSession[], currentUserId: string | null): AgentLogSession[] => {
  if (currentUserId) {
    return sessions.filter(s => s.ownerUserId === currentUserId || s.ownerUserId === undefined);
  }
  return sessions.filter(s => s.ownerUserId === undefined);
};

export { agentLogStorage, selectVisibleSessions };
export type {
  AgentLogEntryType,
  AgentLogSource,
  ChatLogEntry,
  AgentLogEntry,
  AgentTrainingMeta,
  AgentLogSession,
  AgentLogStorageType,
};
