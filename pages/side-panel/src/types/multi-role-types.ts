import type { ChatMessage, WorkflowState } from '../hooks/useAgentChat';
import type { StudentProfile } from '@extension/storage';

interface RoleRunDraft {
  profileId: string;
  profileLabel: string;
}

interface RoleRuntimeConfig {
  dialogueSimulationEnabled: boolean;
  dialogueSimulationContent: string;
  knowledgeBaseEnabled: boolean;
  knowledgeBaseContent: string;
}

interface RoleRunState {
  profileId: string;
  profileLabel: string;
  profile: StudentProfile;
  sessionId: string | null;
  currentStepId: string | null;
  messages: ChatMessage[];
  workflowState: WorkflowState;
  dialogueRound: number;
  logSessionId: string | null;
  error: string | null;
  runtimeConfigOverride: RoleRuntimeConfig | null;
}

interface MultiRoleRunBatch {
  batchId: string;
  trainTaskId: string;
  roles: RoleRunState[];
  activeRoleIndex: number;
  batchState: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'ERROR';
  orderedStepIds: string[];
}

const MAX_MULTI_ROLE_COUNT = 5;

const MULTI_ROLE_POLL_INTERVAL_MS = 500;

const MULTI_ROLE_RETRY_DELAY_MS = 2000;

export { MAX_MULTI_ROLE_COUNT, MULTI_ROLE_POLL_INTERVAL_MS, MULTI_ROLE_RETRY_DELAY_MS };
export type { MultiRoleRunBatch, RoleRunDraft, RoleRunState, RoleRuntimeConfig };
