/**
 * LLM 配置存储模块
 * 存储豆包模型 API 配置
 */

import { createStorage, StorageEnum } from '../base/index.js';

type SystemPromptMode = 'default' | 'custom';

type StudentProfileKey = 'good' | 'medium' | 'bad';

interface StudentProfile {
  label: string;
  description: string;
  style: string;
  fallbackHint: string;
}

// LLM 配置类型
interface LLMConfig {
  apiKey: string;
  apiUrl: string;
  model: string;
  serviceCode: string;
  enabled: boolean;
  systemPromptMode: SystemPromptMode;
  systemPrompt: string;
  studentProfileKey: StudentProfileKey;
}

// 默认配置
const defaultConfig: LLMConfig = {
  apiKey: '',
  apiUrl: 'http://llm-service.polymas.com/api/openai/v1/chat/completions',
  model: 'Doubao-1.5-pro-32k',
  serviceCode: 'SI_Ability',
  enabled: false,
  systemPromptMode: 'default',
  systemPrompt: '',
  studentProfileKey: 'medium',
};

// 可用的模型列表
const AVAILABLE_MODELS = [
  { value: 'Doubao-1.5-pro-32k', label: 'Doubao 1.5 Pro 32K' },
  { value: 'Doubao-1.5-pro-256k', label: 'Doubao 1.5 Pro 256K' },
  { value: 'Doubao-pro-32k', label: 'Doubao Pro 32K' },
  { value: 'Doubao-pro-128k', label: 'Doubao Pro 128K' },
  { value: 'Doubao-lite-32k', label: 'Doubao Lite 32K' },
] as const;

const DEFAULT_PROFILE_KEY: StudentProfileKey = 'medium';

const DEFAULT_SYSTEM_PROMPT = '你是一名能力训练助手，需要严格按照给定的学生档位扮演角色。';

const STUDENT_PROFILES: Record<StudentProfileKey, StudentProfile> = {
  good: {
    label: '优秀学生',
    description: '理解透彻、表达清晰，回答结构化、条理分明，并主动总结要点。',
    style: '语气自信、语言规范，必要时引用题目或材料中的关键信息。',
    fallbackHint: '若模拟对话中没有合适示例，可自己组织最佳答案，保持高水平。',
  },
  medium: {
    label: '需要引导的学生',
    description: '基本理解问题但不够全面，回答中会暴露疑惑或请求提示。',
    style: '语气略显犹豫，能覆盖核心内容，但会提出 1-2 个不确定点或寻求老师建议。',
    fallbackHint: '示例缺失时，先回答主要内容再说明不确定之处。',
  },
  bad: {
    label: '答非所问的学生',
    description: '理解偏差，常常跑题或只复述与问题弱相关的信息。',
    style: '语气随意，容易偏离重点或答非所问。',
    fallbackHint: '即使需要自己生成，也要保持轻微跑题或误解的特征。',
  },
};

const normalizeConfig = (config: Partial<LLMConfig>): LLMConfig => ({
  ...defaultConfig,
  ...config,
});

const storage = createStorage<LLMConfig>('llm-config-storage-key', defaultConfig, {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});

const llmConfigStorage = {
  ...storage,
  get: async () => normalizeConfig(await storage.get()),

  // 更新 API Key
  setApiKey: async (apiKey: string) => {
    await storage.set(current =>
      normalizeConfig({
        ...current,
        apiKey,
        enabled: apiKey.trim().length > 0,
      }),
    );
  },

  // 更新模型
  setModel: async (model: string) => {
    await storage.set(current =>
      normalizeConfig({
        ...current,
        model,
      }),
    );
  },

  // 更新完整配置
  setConfig: async (config: Partial<LLMConfig>) => {
    await storage.set(current =>
      normalizeConfig({
        ...current,
        ...config,
      }),
    );
  },

  // 检查配置是否有效
  isConfigValid: async (): Promise<boolean> => {
    const config = normalizeConfig(await storage.get());
    return config.apiKey.trim().length > 0;
  },

  // 重置为默认配置
  reset: async () => {
    await storage.set(() => defaultConfig);
  },
};

export type { LLMConfig, StudentProfile, StudentProfileKey, SystemPromptMode };
export { AVAILABLE_MODELS, DEFAULT_PROFILE_KEY, DEFAULT_SYSTEM_PROMPT, STUDENT_PROFILES, llmConfigStorage };
