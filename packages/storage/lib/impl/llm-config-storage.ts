/**
 * LLM 配置存储模块
 * 存储豆包模型 API 配置
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
  serviceCode: string;
  enabled: boolean;
  systemPromptMode: SystemPromptMode;
  systemPrompt: string;
  studentProfileId: StudentProfileId;
  studentProfiles: StudentProfile[];
}

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
  model: 'Doubao-1.5-pro-32k',
  serviceCode: 'SI_Ability',
  enabled: false,
  systemPromptMode: 'default',
  systemPrompt: '',
  studentProfileId: DEFAULT_PROFILE_ID,
  studentProfiles: DEFAULT_STUDENT_PROFILES,
};

// 可用的模型列表
const AVAILABLE_MODELS = [
  { value: 'Doubao-1.5-pro-32k', label: 'Doubao 1.5 Pro 32K（推荐）' },
  { value: 'Doubao-1.5-pro-256k', label: 'Doubao 1.5 Pro 256K' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o-mini' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'Claude 3.5 HaiKu', label: 'Claude 3.5 HaiKu' },
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

const normalizeConfig = (config: Partial<LLMConfig>): LLMConfig => {
  const legacy = config as LegacyLLMConfigV1;
  const studentProfiles = normalizeStudentProfiles(config.studentProfiles ?? resolveLegacyProfiles(legacy));
  const selectedId = typeof config.studentProfileId === 'string' ? config.studentProfileId : legacy.studentProfileKey;
  const fallbackId = studentProfiles[0]?.id ?? DEFAULT_PROFILE_ID;

  return {
    ...defaultConfig,
    ...config,
    studentProfiles,
    studentProfileId:
      selectedId && studentProfiles.some(profile => profile.id === selectedId) ? selectedId : fallbackId,
  };
};

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

export type { LLMConfig, StudentProfile, StudentProfileId, SystemPromptMode };
export { AVAILABLE_MODELS, DEFAULT_PROFILE_ID, DEFAULT_SYSTEM_PROMPT, DEFAULT_STUDENT_PROFILES, llmConfigStorage };
