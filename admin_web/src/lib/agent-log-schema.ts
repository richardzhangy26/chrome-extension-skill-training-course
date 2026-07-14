import { z } from 'zod';

/** 单条对话日志条目（与扩展 agent-log-storage 的 ChatLogEntry 对应） */
const chatLogEntrySchema = z.object({
  type: z.literal('chat'),
  timestamp: z.number(),
  stepId: z.string(),
  stepName: z.string().optional(),
  round: z.number(),
  source: z.enum(['runCard', 'chat']),
  userText: z.string().optional(),
  aiText: z.string().optional(),
});

const agentTrainingMetaSchema = z.object({
  courseId: z.string().optional(),
  courseName: z.string().optional(),
  schoolName: z.string().optional(),
  regionName: z.string().optional(),
  agentName: z.string().optional(),
});

/**
 * 扩展 AgentLogSession 的服务端镜像（与
 * packages/storage/lib/impl/agent-log-storage.ts 的 AgentLogSession 对应）。
 * 注意：不含 ownerUserId——归属由服务端按 bearer token 决定，不持久化客户端字段。
 * z.object 默认剥离未知键，故客户端误带 ownerUserId 也会被去除。
 */
export const agentLogSessionSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  taskName: z.string().optional(),
  trainingMeta: agentTrainingMetaSchema.optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  stepNameMapping: z.record(z.string(), z.string()).optional(),
  entries: z.array(chatLogEntrySchema),
});

export type AgentLogSessionInput = z.infer<typeof agentLogSessionSchema>;

export interface Tombstone {
  sessionId: string;
  deletedAt: number;
}
