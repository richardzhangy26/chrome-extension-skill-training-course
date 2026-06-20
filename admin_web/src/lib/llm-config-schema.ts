import { z } from 'zod';

/** 学生档位 */
const studentProfileSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  style: z.string(),
  fallbackHint: z.string(),
});

/**
 * 扩展 LLMConfig 的服务端镜像（与
 * packages/storage/lib/impl/llm-config-storage.ts 的 LLMConfig 一一对应）。
 */
export const llmConfigSchema = z.object({
  apiKey: z.string(),
  apiUrl: z.string(),
  model: z.string(),
  temperature: z.number(),
  topK: z.number().int(),
  maxTokens: z.number().int(),
  maxHistoryRounds: z.number().int(),
  serviceCode: z.string(),
  enabled: z.boolean(),
  systemPromptMode: z.enum(['default', 'custom']),
  systemPrompt: z.string(),
  studentProfileId: z.string(),
  studentProfiles: z.array(studentProfileSchema),
  dialogueSimulationEnabled: z.boolean(),
  dialogueSimulationContent: z.string(),
  knowledgeBaseEnabled: z.boolean(),
  knowledgeBaseContent: z.string(),
  voiceModeEnabled: z.boolean(),
  ttsApiUrl: z.string(),
  ttsModel: z.string(),
  voice: z.string(),
  speed: z.number(),
  ttsResponseFormat: z.enum(['mp3', 'wav', 'opus']),
});

export type LlmConfigInput = z.infer<typeof llmConfigSchema>;

export const defaultLlmConfig: LlmConfigInput = {
  apiKey: '',
  apiUrl: 'http://llm-service.polymas.com/api/openai/v1/chat/completions',
  model: 'Doubao-1.5-pro-32k',
  temperature: 0.7,
  topK: 50,
  maxTokens: 200,
  maxHistoryRounds: 5,
  serviceCode: 'SI_Ability',
  enabled: false,
  systemPromptMode: 'default',
  systemPrompt: '',
  studentProfileId: 'medium',
  studentProfiles: [
    {
      id: 'good',
      label: '优秀学生',
      description: '',
      style: '',
      fallbackHint: '',
    },
    {
      id: 'medium',
      label: '需要引导的学生',
      description: '',
      style: '',
      fallbackHint: '',
    },
    {
      id: 'bad',
      label: '答非所问的学生',
      description: '',
      style: '',
      fallbackHint: '',
    },
  ],
  dialogueSimulationEnabled: false,
  dialogueSimulationContent: '',
  knowledgeBaseEnabled: false,
  knowledgeBaseContent: '',
  voiceModeEnabled: false,
  ttsApiUrl: 'https://llm-service.polymas.com/api/openai/v1/audio/speech/stream',
  ttsModel: 'cosyvoice-v1',
  voice: 'loongstella',
  speed: 1.0,
  ttsResponseFormat: 'mp3',
};
