/**
 * LLM 配置存储模块
 * 存储豆包模型 API 配置
 */

import { createStorage, StorageEnum } from '../base/index.js';

// LLM 配置类型
export interface LLMConfig {
  apiKey: string;
  apiUrl: string;
  model: string;
  serviceCode: string;
  enabled: boolean;
}

// 默认配置
const defaultConfig: LLMConfig = {
  apiKey: '',
  apiUrl: 'http://llm-service.polymas.com/api/openai/v1/chat/completions',
  model: 'Doubao-1.5-pro-32k',
  serviceCode: 'SI_Ability',
  enabled: false,
};

// 可用的模型列表
export const AVAILABLE_MODELS = [
  { value: 'Doubao-1.5-pro-32k', label: 'Doubao 1.5 Pro 32K' },
  { value: 'Doubao-1.5-pro-256k', label: 'Doubao 1.5 Pro 256K' },
  { value: 'Doubao-pro-32k', label: 'Doubao Pro 32K' },
  { value: 'Doubao-pro-128k', label: 'Doubao Pro 128K' },
  { value: 'Doubao-lite-32k', label: 'Doubao Lite 32K' },
] as const;

const storage = createStorage<LLMConfig>(
  'llm-config-storage-key',
  defaultConfig,
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

export const llmConfigStorage = {
  ...storage,

  // 更新 API Key
  setApiKey: async (apiKey: string) => {
    await storage.set(current => ({
      ...current,
      apiKey,
      enabled: apiKey.trim().length > 0,
    }));
  },

  // 更新模型
  setModel: async (model: string) => {
    await storage.set(current => ({
      ...current,
      model,
    }));
  },

  // 更新完整配置
  setConfig: async (config: Partial<LLMConfig>) => {
    await storage.set(current => ({
      ...current,
      ...config,
    }));
  },

  // 检查配置是否有效
  isConfigValid: async (): Promise<boolean> => {
    const config = await storage.get();
    return config.apiKey.trim().length > 0;
  },

  // 重置为默认配置
  reset: async () => {
    await storage.set(() => defaultConfig);
  },
};
