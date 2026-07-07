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
 * 扩展 LLMConfig 的服务端镜像。
 * 仅保存需要跨设备同步的字段（与
 * packages/storage/lib/impl/llm-config-storage.ts 的 SYNCED_LLM_CONFIG_KEYS 对齐）。
 * 采样参数、开关、TTS 等本地字段不再入库，由插件本地保存。
 */
export const llmConfigSchema = z.object({
  apiKey: z.string(),
  apiUrl: z.string(),
  model: z.string(),
  systemPrompt: z.string(),
  studentProfiles: z.array(studentProfileSchema),
  dialogueSimulationContent: z.string(),
  knowledgeBaseContent: z.string(),
});

export type LlmConfigInput = z.infer<typeof llmConfigSchema>;

export const SYNCED_LLM_CONFIG_KEYS = [
  'apiKey',
  'apiUrl',
  'model',
  'systemPrompt',
  'studentProfiles',
  'dialogueSimulationContent',
  'knowledgeBaseContent',
] as const satisfies readonly (keyof LlmConfigInput)[];

export const defaultLlmConfig: LlmConfigInput = {
  apiKey: '',
  apiUrl: 'http://llm-service.polymas.com/api/openai/v1/chat/completions',
  model: 'Doubao-1.5-pro-32k',
  systemPrompt: '',
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
  dialogueSimulationContent: '',
  knowledgeBaseContent: '',
};
