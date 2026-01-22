/**
 * 智能体日志存储
 */

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
}

type AgentLogEntry = ChatLogEntry;

interface AgentLogSession {
  id: string;
  taskId: string;
  taskName?: string;
  createdAt: number;
  updatedAt: number;
  stepNameMapping?: Record<string, string>;
  entries: AgentLogEntry[];
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
    stepNameMapping?: Record<string, string>;
  }) => Promise<AgentLogSession>;
  addEntry: (sessionId: string, entry: AgentLogEntry) => Promise<void>;
  updateStepNameMapping: (sessionId: string, mapping: Record<string, string>) => Promise<void>;
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

  createSession: async ({ taskId, taskName, stepNameMapping }) => {
    const now = Date.now();
    const session: AgentLogSession = {
      id: generateSessionId(),
      taskId,
      taskName,
      createdAt: now,
      updatedAt: now,
      stepNameMapping,
      entries: [],
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

export { agentLogStorage };
export type { AgentLogEntryType, AgentLogSource, ChatLogEntry, AgentLogEntry, AgentLogSession, AgentLogStorageType };
