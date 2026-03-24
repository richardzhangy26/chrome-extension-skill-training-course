/**
 * LLM 配置存储模块
 * 存储 LLM API 配置
 */

import { createStorage, StorageEnum } from '../base/index.js';

type SystemPromptMode = 'default' | 'custom';

type StudentProfileId = string;

interface StudentProfile {
  id: StudentProfileId;
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
  temperature: number;
  topK: number;
  maxTokens: number;
  maxHistoryRounds: number;
  serviceCode: string;
  enabled: boolean;
  systemPromptMode: SystemPromptMode;
  systemPrompt: string;
  studentProfileId: StudentProfileId;
  studentProfiles: StudentProfile[];
  dialogueSimulationEnabled: boolean;
  dialogueSimulationContent: string;
  knowledgeBaseEnabled: boolean;
  knowledgeBaseContent: string;
}

type LLMConfigInput = Partial<Omit<LLMConfig, 'model' | 'temperature' | 'topK' | 'maxTokens' | 'maxHistoryRounds'>> & {
  model?: unknown;
  temperature?: unknown;
  topK?: unknown;
  maxTokens?: unknown;
  maxHistoryRounds?: unknown;
};

interface LegacyStudentProfile {
  label: string;
  description: string;
  style: string;
  fallbackHint: string;
}

interface LegacyLLMConfigV1 {
  studentProfileKey?: string;
  studentProfiles?: Record<string, LegacyStudentProfile>;
}

const DEFAULT_PROFILE_ID: StudentProfileId = 'medium';
const DEFAULT_LLM_MODEL = 'Doubao-1.5-pro-32k';
const DEFAULT_LLM_TEMPERATURE = 0.7;
const DEFAULT_LLM_TOP_K = 50;
const DEFAULT_LLM_MAX_TOKENS = 200;
const DEFAULT_LLM_MAX_HISTORY_ROUNDS = 5;

const DEFAULT_STUDENT_PROFILES: StudentProfile[] = [
  {
    id: 'good',
    label: '优秀学生',
    description: '理解透彻、表达清晰，回答结构化、条理分明，并主动总结要点。',
    style: '语气自信、语言规范，必要时引用题目或材料中的关键信息。',
    fallbackHint: '若模拟对话中没有合适示例，可自己组织最佳答案，保持高水平。',
  },
  {
    id: 'medium',
    label: '需要引导的学生',
    description: '基本理解问题但不够全面，回答中会暴露疑惑或请求提示。',
    style: '语气略显犹豫，能覆盖核心内容，但会提出 1-2 个不确定点或寻求老师建议。',
    fallbackHint: '示例缺失时，先回答主要内容再说明不确定之处。',
  },
  {
    id: 'bad',
    label: '答非所问的学生',
    description: '理解偏差，常常跑题或只复述与问题弱相关的信息。',
    style: '语气随意，容易偏离重点或答非所问。',
    fallbackHint: '即使需要自己生成，也要保持轻微跑题或误解的特征。',
  },
];

// 默认配置
const defaultConfig: LLMConfig = {
  apiKey: '',
  apiUrl: 'http://llm-service.polymas.com/api/openai/v1/chat/completions',
  model: DEFAULT_LLM_MODEL,
  temperature: DEFAULT_LLM_TEMPERATURE,
  topK: DEFAULT_LLM_TOP_K,
  maxTokens: DEFAULT_LLM_MAX_TOKENS,
  maxHistoryRounds: DEFAULT_LLM_MAX_HISTORY_ROUNDS,
  serviceCode: 'SI_Ability',
  enabled: false,
  systemPromptMode: 'default',
  systemPrompt: '',
  studentProfileId: DEFAULT_PROFILE_ID,
  studentProfiles: DEFAULT_STUDENT_PROFILES,
  dialogueSimulationEnabled: false,
  dialogueSimulationContent: '',
  knowledgeBaseEnabled: false,
  knowledgeBaseContent: '',
};

// 可用的模型列表
const AVAILABLE_MODELS = [
  { value: 'Doubao-Seed-2.0-pro', label: 'Doubao Seed 2.0 Pro（推荐）' },
  { value: 'Doubao-Seed-2.0-lite', label: 'Doubao Seed 2.0 Lite' },
  { value: 'Doubao-Seed-2.0-mini', label: 'Doubao Seed 2.0 Mini' },
  { value: 'Doubao-Seed-2.0-Code', label: 'Doubao Seed 2.0 Code' },
  { value: 'Doubao-Seed-1.8', label: 'Doubao Seed 1.8' },
  { value: 'Doubao-Seed-1.6', label: 'Doubao Seed 1.6' },
  { value: 'Doubao-Seed-1.6-flash', label: 'Doubao Seed 1.6 Flash' },
  { value: 'Doubao-Seed-1.6-thinking', label: 'Doubao Seed 1.6 Thinking' },
  { value: 'Doubao-1.5-pro-32k', label: 'Doubao 1.5 Pro 32K（推荐）' },
  { value: 'Doubao-1.5-pro-256k', label: 'Doubao 1.5 Pro 256K' },
  { value: 'Doubao-1.5-lite-32k', label: 'Doubao 1.5 Lite 32K' },
  { value: 'Doubao-pro-32k', label: 'Doubao Pro 32K' },
  { value: 'Doubao-pro-128k', label: 'Doubao Pro 128K' },
  { value: 'deepseek-v3.1', label: 'DeepSeek V3.1' },
  { value: 'deepseek-v3', label: 'DeepSeek V3' },
  { value: 'deepseek-chat', label: 'DeepSeek Chat' },
  { value: 'deepseek-r1', label: 'DeepSeek R1' },
  { value: 'qwen-plus-latest', label: 'Qwen Plus Latest' },
  { value: 'qwen-max-latest', label: 'Qwen Max Latest' },
  { value: 'qwen3-max', label: 'Qwen3 Max' },
  { value: 'qwen-plus', label: 'Qwen Plus' },
  { value: 'qwen-max', label: 'Qwen Max' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o-mini' },
  { value: 'gpt-4.1', label: 'GPT-4.1' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
  { value: 'gpt-5', label: 'GPT-5' },
  { value: 'gpt-5-mini', label: 'GPT-5 Mini' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { value: 'Claude 3.5 HaiKu', label: 'Claude 3.5 HaiKu' },
  { value: 'Claude Sonnet 4.5', label: 'Claude Sonnet 4.5' },
  { value: 'claude-4.5-sonnet', label: 'Claude 4.5 Sonnet' },
  { value: 'grok-4', label: 'Grok 4' },
] as const;

const DEFAULT_SYSTEM_PROMPT = [
  '你是一名能力训练助手，需要严格按照给定的学生档位扮演角色。',
  '',
  '## 问题类型识别（优先级最高）',
  '如果当前问题属于以下类型，请优先直接回答，不需要强制体现性格特点：',
  "1. **确认式问题**: 如'你准备好了吗？请回复是或否'、'确认的话请回复是'",
  "   → 直接回答'是'、'好的'、'确认'等",
  "2. **选择式问题**: 如'你选择A还是B？'、'请选择1/2/3'",
  "   → 直接说出选项，如'我选择A'、'选1'",
  "3. **角色确认问题**: 如'你是学生还是老师？'",
  "   → 直接回答角色，如'学生'",
  '',
  "**判断标准**: 如果问题中包含'请回复'、'请选择'、'是或否'、'A/B/C'等明确指示，则为封闭式问题。",
  '',
  '## 输出要求（按优先级执行）',
  '**优先级1**: 如果是封闭式问题（确认式/选择式/角色确认），直接简短回答',
  '**优先级2**: 如果示例对话中有高度相关的回答，请优先引用或改写',
  '**优先级3**: 如果是开放式问题，再适度融入学生档位特点',
  '**格式要求**: 仅返回学生回答内容，不要额外解释，控制在50字以内。',
].join('\n');

const normalizeStudentProfiles = (profiles: unknown): StudentProfile[] => {
  if (!Array.isArray(profiles)) {
    return DEFAULT_STUDENT_PROFILES;
  }

  const normalized = profiles
    .filter(profile => profile && typeof profile === 'object')
    .map((profile, index) => {
      const entry = profile as Partial<StudentProfile>;
      const id = typeof entry.id === 'string' && entry.id.trim().length > 0 ? entry.id.trim() : `profile-${index + 1}`;
      const label = typeof entry.label === 'string' ? entry.label.trim() : '';
      const description = typeof entry.description === 'string' ? entry.description.trim() : '';
      const style = typeof entry.style === 'string' ? entry.style.trim() : '';
      const fallbackHint = typeof entry.fallbackHint === 'string' ? entry.fallbackHint.trim() : '';

      return {
        id,
        label,
        description,
        style,
        fallbackHint,
      };
    });

  return normalized.length > 0 ? normalized : DEFAULT_STUDENT_PROFILES;
};

const parseFiniteNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const normalizeModel = (model: unknown) => {
  if (typeof model !== 'string') {
    return DEFAULT_LLM_MODEL;
  }

  const trimmed = model.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_LLM_MODEL;
};

const normalizeTemperature = (temperature: unknown) => {
  const parsed = parseFiniteNumber(temperature);
  return parsed !== null && parsed >= 0 ? parsed : DEFAULT_LLM_TEMPERATURE;
};

const normalizePositiveInteger = (value: unknown, fallback: number) => {
  const parsed = parseFiniteNumber(value);
  return parsed !== null && Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeBoolean = (value: unknown, fallback = false) => (typeof value === 'boolean' ? value : fallback);

const normalizeOptionalText = (value: unknown) => (typeof value === 'string' ? value : '');

const resolveLegacyProfiles = (legacy: LegacyLLMConfigV1): StudentProfile[] => {
  if (!legacy.studentProfiles || typeof legacy.studentProfiles !== 'object') {
    return DEFAULT_STUDENT_PROFILES;
  }

  const entries = Object.entries(legacy.studentProfiles);
  if (entries.length === 0) {
    return DEFAULT_STUDENT_PROFILES;
  }

  return entries.map(([key, value]) => ({
    id: key,
    label: value.label,
    description: value.description,
    style: value.style,
    fallbackHint: value.fallbackHint,
  }));
};

const normalizeLLMConfig = (config: LLMConfigInput): LLMConfig => {
  const legacy = config as LegacyLLMConfigV1;
  const studentProfiles = normalizeStudentProfiles(config.studentProfiles ?? resolveLegacyProfiles(legacy));
  const selectedId = typeof config.studentProfileId === 'string' ? config.studentProfileId : legacy.studentProfileKey;
  const fallbackId = studentProfiles[0]?.id ?? DEFAULT_PROFILE_ID;

  return {
    ...defaultConfig,
    ...config,
    model: normalizeModel(config.model),
    temperature: normalizeTemperature(config.temperature),
    topK: normalizePositiveInteger(config.topK, DEFAULT_LLM_TOP_K),
    maxTokens: normalizePositiveInteger(config.maxTokens, DEFAULT_LLM_MAX_TOKENS),
    maxHistoryRounds: normalizePositiveInteger(config.maxHistoryRounds, DEFAULT_LLM_MAX_HISTORY_ROUNDS),
    studentProfiles,
    studentProfileId:
      selectedId && studentProfiles.some(profile => profile.id === selectedId) ? selectedId : fallbackId,
    dialogueSimulationEnabled: normalizeBoolean(config.dialogueSimulationEnabled),
    dialogueSimulationContent: normalizeOptionalText(config.dialogueSimulationContent),
    knowledgeBaseEnabled: normalizeBoolean(config.knowledgeBaseEnabled),
    knowledgeBaseContent: normalizeOptionalText(config.knowledgeBaseContent),
  };
};

const storage = createStorage<LLMConfig>('llm-config-storage-key', defaultConfig, {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});

const llmConfigStorage = {
  ...storage,
  get: async () => normalizeLLMConfig(await storage.get()),

  // 更新 API Key
  setApiKey: async (apiKey: string) => {
    await storage.set(current =>
      normalizeLLMConfig({
        ...current,
        apiKey,
        enabled: apiKey.trim().length > 0,
      }),
    );
  },

  // 更新模型
  setModel: async (model: string) => {
    await storage.set(current =>
      normalizeLLMConfig({
        ...current,
        model,
      }),
    );
  },

  // 更新完整配置
  setConfig: async (config: LLMConfigInput) => {
    await storage.set(current =>
      normalizeLLMConfig({
        ...current,
        ...config,
      }),
    );
  },

  // 检查配置是否有效
  isConfigValid: async (): Promise<boolean> => {
    const config = normalizeLLMConfig(await storage.get());
    return config.apiKey.trim().length > 0;
  },

  // 重置为默认配置
  reset: async () => {
    await storage.set(() => defaultConfig);
  },
};

export type { LLMConfig, LLMConfigInput, StudentProfile, StudentProfileId, SystemPromptMode };
export {
  AVAILABLE_MODELS,
  DEFAULT_LLM_MAX_HISTORY_ROUNDS,
  DEFAULT_LLM_MAX_TOKENS,
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_TEMPERATURE,
  DEFAULT_LLM_TOP_K,
  DEFAULT_PROFILE_ID,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_STUDENT_PROFILES,
  llmConfigStorage,
  normalizeLLMConfig,
};
