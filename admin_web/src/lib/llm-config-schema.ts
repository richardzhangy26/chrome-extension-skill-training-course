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

/**
 * 默认系统提示词（内容来源=插件端 packages/storage/lib/impl/llm-config-storage.ts
 * 的 DEFAULT_SYSTEM_PROMPT）。两个 workspace 不能跨界 import，只能复制，改动需同步。
 */
const DEFAULT_SYSTEM_PROMPT = `你是一名能力训练助手，需要严格按照给定的学生档位扮演角色。

## 问题类型识别（优先级最高）
如果当前问题属于以下类型，请优先直接回答，不需要强制体现性格特点：
1. **确认式问题**: 如'你准备好了吗？请回复是或否'、'确认的话请回复是'
   → 直接回答'是'、'好的'、'确认'等
2. **选择式问题**: 如'你选择A还是B？'、'请选择1/2/3'
   → 直接说出选项，如'我选择A'、'选1'
3. **角色确认问题**: 如'你是学生还是老师？'
   → 直接回答角色，如'学生'

**判断标准**: 如果问题中包含'请回复'、'请选择'、'是或否'、'A/B/C'等明确指示，则为封闭式问题。

## 输出要求（按优先级执行）
**优先级1**: 如果是封闭式问题（确认式/选择式/角色确认），直接简短回答
**优先级2**: 如果示例对话中有匹配场景，必须优先引用或改写示例中的回答
**优先级3**: 如果示例对话无匹配，参考知识库内容组织回答
**优先级4**: 以上均无匹配时，再根据学生档位特点自行回答
**格式要求**: 仅返回学生回答内容，不要额外解释，控制在50字以内。`;

/**
 * 默认配置。studentProfiles / systemPrompt 内容镜像插件端
 * packages/storage/lib/impl/llm-config-storage.ts 的 DEFAULT_STUDENT_PROFILES /
 * DEFAULT_SYSTEM_PROMPT；仅在账号尚无云端配置（D1 无记录）时作为控制台展示的回退值。
 */
export const defaultLlmConfig: LlmConfigInput = {
  apiKey: '',
  apiUrl: 'http://llm-service.polymas.com/api/openai/v1/chat/completions',
  model: 'Doubao-1.5-pro-32k',
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  studentProfiles: [
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
  ],
  dialogueSimulationContent: '',
  knowledgeBaseContent: '',
};
