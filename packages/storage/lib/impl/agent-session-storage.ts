/**
 * 智能体会话状态存储
 */

import { createStorage, StorageEnum } from '../base/index.js';
import type { BaseStorageType } from '../base/index.js';
// 类型定义 - 避免循环依赖，在此处内联定义
export type WorkflowState =
  | 'IDLE'
  | 'FETCHING_STEPS'
  | 'FETCHING_FIRST_STEP'
  | 'RUNNING_CARD'
  | 'CHATTING'
  | 'COMPLETED'
  | 'ERROR';

export interface AgentSession {
  trainTaskId: string;
  sessionId: string | null;
  currentStepId: string | null;
  workflowState: WorkflowState;
  dialogueRound: number;
  lastUpdated: number;
}

const STORAGE_KEY_AGENT_SESSION = 'agent-session';

const DEFAULT_SESSION: AgentSession = {
  trainTaskId: '',
  sessionId: null,
  currentStepId: null,
  workflowState: 'IDLE',
  dialogueRound: 0,
  lastUpdated: Date.now(),
};

const storage = createStorage<AgentSession>(STORAGE_KEY_AGENT_SESSION, DEFAULT_SESSION, {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});

export interface AgentSessionStorageType extends BaseStorageType<AgentSession> {
  updateTrainTaskId: (trainTaskId: string) => Promise<void>;
  updateSessionId: (sessionId: string) => Promise<void>;
  updateCurrentStepId: (stepId: string) => Promise<void>;
  updateWorkflowState: (state: WorkflowState) => Promise<void>;
  incrementDialogueRound: () => Promise<void>;
  reset: () => Promise<void>;
}

export const agentSessionStorage: AgentSessionStorageType = {
  ...storage,

  updateTrainTaskId: async (trainTaskId: string) => {
    await storage.set(current => ({
      ...current,
      trainTaskId,
      lastUpdated: Date.now(),
    }));
  },

  updateSessionId: async (sessionId: string) => {
    await storage.set(current => ({
      ...current,
      sessionId,
      lastUpdated: Date.now(),
    }));
  },

  updateCurrentStepId: async (stepId: string) => {
    await storage.set(current => ({
      ...current,
      currentStepId: stepId,
      lastUpdated: Date.now(),
    }));
  },

  updateWorkflowState: async (state: WorkflowState) => {
    await storage.set(current => ({
      ...current,
      workflowState: state,
      lastUpdated: Date.now(),
    }));
  },

  incrementDialogueRound: async () => {
    await storage.set(current => ({
      ...current,
      dialogueRound: current.dialogueRound + 1,
      lastUpdated: Date.now(),
    }));
  },

  reset: async () => {
    await storage.set({
      ...DEFAULT_SESSION,
      lastUpdated: Date.now(),
    });
  },
};
