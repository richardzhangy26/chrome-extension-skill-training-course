/**
 * LLM 服务 - 调用 LLM 模型生成回答
 * 参考 Python: auto_script_train.py 中的 _call_doubao_post 方法
 */

import { apiRequest, API_ENDPOINTS } from './background-bridge';
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_PROFILE_ID, llmConfigStorage, normalizeLLMConfig } from '@extension/storage';
import type { LLMConfig, StudentProfile } from '@extension/storage';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LLMResponse {
  success: boolean;
  content?: string;
  error?: string;
}

interface LLMApiResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

interface OpenAIModelsResponse {
  data?: Array<{
    id?: string;
  }>;
}

interface ApiResponse<T> {
  code: number;
  message?: string | null;
  msg?: string | null;
  success?: boolean;
  data: T;
}

interface ScriptStepItem {
  stepId: string;
  stepDetailDTO?: {
    stepName?: string;
    stepOrder?: number;
    nodeType?: 'SCRIPT_START' | 'SCRIPT_END' | 'SCRIPT_NODE';
    prologue?: string;
    interactiveRounds?: number | null;
    description?: string;
    llmPrompt?: string;
    trainerName?: string;
  };
}

interface ScriptStepFlow {
  scriptStepStartId: string;
  scriptStepEndId: string;
  isDefault?: number;
}

type GeneratorProfile = 'good' | 'medium' | 'poor';

interface RuntimeProfileOverride {
  profile: StudentProfile;
}

interface DialogueGeneratorStage {
  stepId: string;
  stepName: string;
  interactiveRounds: number;
  prologue: string;
  description: string;
  llmPrompt: string;
  trainerName: string;
}

interface SimulationDialogueGenerationParams {
  trainTaskId: string;
  profile: GeneratorProfile;
}

const DIALOGUE_SIMULATION_LINE_PATTERN = /^(AI|用户)\s*[：:]\s*(.+)$/;
const DIALOGUE_LOG_SEPARATOR = '-'.repeat(40);

const GENERATOR_MODEL_PREFERENCES = [
  {
    label: 'Claude Sonnet 4.6',
    patterns: [/claude.*sonnet.*4\.6/i, /sonnet.*4\.6/i],
    fallbacks: ['claude-4.6-sonnet', 'Claude Sonnet 4.6'],
  },
  {
    label: 'Claude Opus 4.5',
    patterns: [/claude.*opus.*4\.5/i, /opus.*4\.5/i],
    fallbacks: ['claude-opus-4.5', 'Claude Opus 4.5'],
  },
  {
    label: 'Claude Sonnet 4.5',
    patterns: [/claude.*sonnet.*4\.5/i, /sonnet.*4\.5/i],
    fallbacks: ['claude-4.5-sonnet', 'Claude Sonnet 4.5'],
  },
  {
    label: 'GPT-5.4',
    patterns: [/gpt[-\s]?5(?:\.4)?(?!.*mini)/i],
    fallbacks: ['gpt-5.4', 'gpt-5'],
  },
] as const;

const GENERATOR_PROFILE_LABELS: Record<GeneratorProfile, string> = {
  good: '好学生',
  medium: '一般学生',
  poor: '差学生',
};

const GENERATOR_PROFILE_GUIDANCE: Record<GeneratorProfile, string> = {
  good: '目标是最佳通关路线。学生基本回答正确，尽量用最少轮次满足阶段目标并触发进入下一阶段，不要故意绕路。',
  medium: '目标是可通关的真实引导过程。学生首轮通常只答对 60%-70%，需要 2-3 轮逐步补全，在阶段可用轮次内达标。',
  poor: '目标是边界测试。学生可偏题、误解或回答不完整，重点体现智能体如何把学生往回拉；如果轮次不足，允许该阶段仍未达标。',
};

const NON_TEXT_MODEL_PATTERNS = [
  /embedding/i,
  /image/i,
  /vision/i,
  /(^|[-_.])vl([-.]|$)/i,
  /omni/i,
  /seedream/i,
  /stable-diffusion/i,
  /translate/i,
  /ocr/i,
  /speech/i,
  /voice/i,
  /audio/i,
  /tts/i,
  /paraformer/i,
  /cosyvoice/i,
  /rerank/i,
  /markdown/i,
  /pdf/i,
  /compress/i,
  /research/i,
  /(^|[-_.])kb([-.]|$)/i,
  /t2i/i,
  /i2i/i,
  /t2v/i,
  /i2v/i,
  /cogview/i,
  /^wan/i,
  /jimeng/i,
] as const;

const resolveSystemPrompt = (config: LLMConfig) => {
  if (config.systemPromptMode === 'custom' && config.systemPrompt.trim()) {
    return config.systemPrompt.trim();
  }

  return DEFAULT_SYSTEM_PROMPT;
};

const resolveStudentProfile = (config: LLMConfig) => {
  const profiles = config.studentProfiles;
  const selected = profiles.find(profile => profile.id === config.studentProfileId);

  return (
    selected ?? profiles[0] ?? { id: DEFAULT_PROFILE_ID, label: '学生', description: '', style: '', fallbackHint: '' }
  );
};

const normalizeDialogueSimulationContent = (content: string) =>
  content
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .map(line => {
      const matched = line.match(DIALOGUE_SIMULATION_LINE_PATTERN);
      if (!matched) {
        return '';
      }

      const [, role, text] = matched;
      return text.trim() ? `${role}: ${text.trim()}` : '';
    })
    .filter(Boolean)
    .join('\n');

const dedupeStrings = (items: string[]) => {
  const seen = new Set<string>();

  return items.filter(item => {
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) {
      return false;
    }

    seen.add(normalized);
    return true;
  });
};

const buildTextModelHeaders = (config: Pick<LLMConfig, 'apiKey' | 'serviceCode'>) => ({
  'Content-Type': 'application/json',
  ...(config.apiKey.trim() ? { 'api-key': config.apiKey } : {}),
  ...(config.serviceCode.trim() ? { 'service-code': config.serviceCode } : {}),
});

const callChatCompletion = async (
  config: Pick<LLMConfig, 'apiUrl' | 'apiKey' | 'serviceCode' | 'temperature' | 'topK' | 'maxTokens'>,
  model: string,
  messages: ChatMessage[],
  options?: {
    temperature?: number;
    maxTokens?: number;
  },
): Promise<LLMResponse> => {
  try {
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: buildTextModelHeaders(config),
      body: JSON.stringify({
        model,
        messages,
        temperature: options?.temperature ?? config.temperature,
        max_tokens: options?.maxTokens ?? config.maxTokens,
        top_k: config.topK,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `API 请求失败: ${response.status}${errorText ? ` - ${errorText}` : ''}` };
    }

    const data = (await response.json()) as LLMApiResponse;
    const content = extractResponseContent(data);

    if (!content) {
      return { success: false, error: '模型未返回有效内容' };
    }

    return { success: true, content };
  } catch (error) {
    return { success: false, error: `调用失败: ${(error as Error).message}` };
  }
};

const resolveGeneratorModelCandidates = async (
  config: Pick<LLMConfig, 'apiUrl' | 'apiKey' | 'serviceCode' | 'model'>,
): Promise<string[]> => {
  const availableModels = await fetchAvailableTextModels(config).catch(() => []);
  const preferredModels = GENERATOR_MODEL_PREFERENCES.flatMap(preference => {
    const matchedModel = availableModels.find(model => preference.patterns.some(pattern => pattern.test(model)));
    return matchedModel ? [matchedModel] : preference.fallbacks;
  });

  return dedupeStrings([...preferredModels, config.model]);
};

const resolveOrderedScriptStages = (steps: ScriptStepItem[], flows: ScriptStepFlow[]): DialogueGeneratorStage[] => {
  const stepMap = new Map(steps.map(step => [step.stepId, step]));
  const nodeStages: DialogueGeneratorStage[] = [];
  const visitedNodeIds = new Set<string>();
  const trainingStartStepId = steps.find(step => step.stepDetailDTO?.nodeType === 'SCRIPT_START')?.stepId;

  if (trainingStartStepId) {
    let currentStepId: string | null = trainingStartStepId;
    const visitedFlowStarts = new Set<string>();

    while (currentStepId && !visitedFlowStarts.has(currentStepId)) {
      visitedFlowStarts.add(currentStepId);
      const outgoingFlows = flows.filter(flow => flow.scriptStepStartId === currentStepId);
      if (!outgoingFlows.length) {
        break;
      }

      const selectedFlow = outgoingFlows.find(flow => flow.isDefault === 1) ?? outgoingFlows[0];
      currentStepId = selectedFlow?.scriptStepEndId ?? null;

      if (!currentStepId || visitedNodeIds.has(currentStepId)) {
        break;
      }

      const nextStep = stepMap.get(currentStepId);
      const nodeType = nextStep?.stepDetailDTO?.nodeType;
      if (!nextStep || nodeType === 'SCRIPT_END') {
        break;
      }

      if (nodeType === 'SCRIPT_NODE') {
        visitedNodeIds.add(currentStepId);
        nodeStages.push({
          stepId: nextStep.stepId,
          stepName: nextStep.stepDetailDTO?.stepName?.trim() || nextStep.stepId,
          interactiveRounds: Math.max(0, nextStep.stepDetailDTO?.interactiveRounds ?? 0),
          prologue: nextStep.stepDetailDTO?.prologue?.trim() || '',
          description: nextStep.stepDetailDTO?.description?.trim() || '',
          llmPrompt: nextStep.stepDetailDTO?.llmPrompt?.trim() || '',
          trainerName: nextStep.stepDetailDTO?.trainerName?.trim() || '',
        });
      }
    }
  }

  if (nodeStages.length > 0) {
    return nodeStages;
  }

  return steps
    .filter(step => step.stepDetailDTO?.nodeType === 'SCRIPT_NODE')
    .sort(
      (left, right) =>
        (left.stepDetailDTO?.stepOrder ?? Number.MAX_SAFE_INTEGER) -
        (right.stepDetailDTO?.stepOrder ?? Number.MAX_SAFE_INTEGER),
    )
    .map(step => ({
      stepId: step.stepId,
      stepName: step.stepDetailDTO?.stepName?.trim() || step.stepId,
      interactiveRounds: Math.max(0, step.stepDetailDTO?.interactiveRounds ?? 0),
      prologue: step.stepDetailDTO?.prologue?.trim() || '',
      description: step.stepDetailDTO?.description?.trim() || '',
      llmPrompt: step.stepDetailDTO?.llmPrompt?.trim() || '',
      trainerName: step.stepDetailDTO?.trainerName?.trim() || '',
    }));
};

const buildSimulationDialogueMessages = (
  profile: GeneratorProfile,
  stages: DialogueGeneratorStage[],
): ChatMessage[] => {
  const stageBlocks = stages.map((stage, index) =>
    [
      `### 阶段 ${index + 1}`,
      `stepId: ${stage.stepId}`,
      `stepName: ${stage.stepName}`,
      `trainerName: ${stage.trainerName || '未提供'}`,
      `interactiveRounds: ${stage.interactiveRounds}`,
      `prologue:`,
      stage.prologue || '(无)',
      `description:`,
      stage.description || '(无)',
      `llmPrompt:`,
      stage.llmPrompt || '(无)',
    ].join('\n'),
  );

  return [
    {
      role: 'system',
      content: [
        '你是训练剧本模拟对话生成器。',
        '你的唯一任务是根据剧本配置生成“历史对话日志风格”的纯净文本。',
        '只允许输出日志内容，不要输出解释、标题、代码块、分析或额外说明。',
        '每条对话块必须严格使用以下格式：',
        'Step: <stepName> | step_id: <stepId> | 第 <n> 轮 | 来源: chat',
        'AI: <智能体话术>',
        '用户: <学生回答>',
        `${DIALOGUE_LOG_SEPARATOR}`,
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `当前要生成的学生档位：${GENERATOR_PROFILE_LABELS[profile]} (${profile})`,
        GENERATOR_PROFILE_GUIDANCE[profile],
        '',
        '全局生成约束：',
        '1. 好学生走最佳通关路线，尽量用最少轮次达标；一般学生保留2-3轮被引导过程；差学生可用于边界测试，不强制通关。',
        '2. interactiveRounds 是该阶段可用轮次上限，不要超过；可以少于这个数字，但必须体现该档位的典型表现。',
        '3. AI 话术必须贴合每个阶段的 llmPrompt、角色设定和开场白。',
        '4. 用户回答必须符合档位特点，且围绕阶段目标推进。',
        '5. 输出中不要省略任何默认流程中的真实阶段。',
        '6. 输出中不要使用 Markdown 标题、列表、代码块或解释性文字。',
        '',
        '阶段配置如下：',
        stageBlocks.join('\n\n'),
      ].join('\n'),
    },
  ];
};

const buildStudentRoleSystemPrompt = (
  systemPrompt: string,
  profile: { label: string; description: string; style: string; fallbackHint?: string },
  config: Pick<
    LLMConfig,
    'dialogueSimulationEnabled' | 'dialogueSimulationContent' | 'knowledgeBaseEnabled' | 'knowledgeBaseContent'
  >,
) => {
  const sections = [
    systemPrompt,
    '',
    '## 当前扮演设定',
    `学生档位: ${profile.label}`,
    `角色特征: ${profile.description}`,
    `表达风格: ${profile.style}`,
    '',
  ];

  const dialogueSimulationContent = config.dialogueSimulationEnabled
    ? normalizeDialogueSimulationContent(config.dialogueSimulationContent)
    : '';
  if (dialogueSimulationContent) {
    sections.push('## 档位示例对话 (如有匹配请优先引用或改写，优先级最高)', dialogueSimulationContent, '');
  }

  const knowledgeBaseContent = config.knowledgeBaseEnabled ? config.knowledgeBaseContent.trim() : '';
  if (knowledgeBaseContent) {
    sections.push('## 参考知识库 (可结合使用)', knowledgeBaseContent, '');
  }

  return sections.join('\n');
};

const buildStudentReplyInstruction = () =>
  [
    '请继续扮演上面设定的角色，直接回复上一条 assistant 的话。',
    '如果上一条 assistant 是让你做选择、确认或补充内容，请直接作答。',
    '仅输出角色回答内容，不要添加角色标签，不要额外解释。',
  ].join('\n');

const buildRequestPayload = (config: LLMConfig, messages: ChatMessage[]) => ({
  model: config.model,
  messages,
  temperature: config.temperature,
  max_tokens: config.maxTokens,
  top_k: config.topK,
});

const extractResponseContent = (data: LLMApiResponse) => data.choices?.[0]?.message?.content?.trim();

const resolveModelsUrl = (apiUrl: string) => {
  const trimmed = apiUrl.trim();
  if (!trimmed) {
    return '';
  }

  try {
    const url = new URL(trimmed);
    const pathname = url.pathname.replace(/\/+$/, '');

    if (/\/models$/i.test(pathname)) {
      url.search = '';
      return url.toString();
    }

    let nextPathname = pathname.replace(/\/chat\/completions$/i, '/models').replace(/\/completions$/i, '/models');

    if (nextPathname === pathname) {
      const versionMatch = pathname.match(/^(.*\/v\d+)(?:\/.*)?$/i);
      nextPathname = versionMatch ? `${versionMatch[1]}/models` : `${pathname}/models`;
    }

    url.pathname = nextPathname;
    url.search = '';
    return url.toString();
  } catch {
    return '';
  }
};

const extractModelIds = (data: unknown) => {
  if (Array.isArray(data)) {
    return data.filter((item): item is string => typeof item === 'string');
  }

  if (data && typeof data === 'object' && Array.isArray((data as OpenAIModelsResponse).data)) {
    const modelItems = (data as OpenAIModelsResponse).data ?? [];
    return modelItems.map(item => (typeof item?.id === 'string' ? item.id : '')).filter(Boolean);
  }

  return [];
};

const isTextModel = (model: string) => !NON_TEXT_MODEL_PATTERNS.some(pattern => pattern.test(model));

const dedupeModels = (models: string[]) => {
  const seen = new Set<string>();

  return models.filter(model => {
    const trimmed = model.trim();
    if (!trimmed || seen.has(trimmed)) {
      return false;
    }

    seen.add(trimmed);
    return true;
  });
};

const fetchAvailableTextModels = async (
  config: Pick<LLMConfig, 'apiUrl' | 'apiKey' | 'serviceCode'>,
): Promise<string[]> => {
  const modelsUrl = resolveModelsUrl(config.apiUrl);

  if (!modelsUrl) {
    throw new Error('API URL 无法解析出 models 接口地址');
  }

  const response = await fetch(modelsUrl, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey.trim() ? { 'api-key': config.apiKey } : {}),
      ...(config.serviceCode.trim() ? { 'service-code': config.serviceCode } : {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`模型列表获取失败: ${response.status}${errorText ? ` - ${errorText}` : ''}`);
  }

  const data = (await response.json()) as unknown;

  return dedupeModels(extractModelIds(data).filter(isTextModel));
};

/**
 * 调用 LLM 模型生成学生回答
 */
const generateStudentAnswer = async (
  aiQuestion: string,
  conversationHistory: Array<{ ai: string; student: string }> = [],
  runtimeOverride?: RuntimeProfileOverride,
): Promise<LLMResponse> => {
  // 获取配置
  const config = normalizeLLMConfig(await llmConfigStorage.get());

  if (!config.apiKey) {
    return { success: false, error: '请先配置 LLM API Key' };
  }

  try {
    const systemPrompt = resolveSystemPrompt(config);
    const profile = runtimeOverride?.profile ?? resolveStudentProfile(config);
    const roleSystemPrompt = buildStudentRoleSystemPrompt(systemPrompt, profile, config);

    const historyMessages: ChatMessage[] = [];
    for (const turn of conversationHistory.slice(-config.maxHistoryRounds)) {
      historyMessages.push({ role: 'assistant', content: turn.ai });
      historyMessages.push({ role: 'user', content: turn.student });
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: roleSystemPrompt },
      ...historyMessages,
      { role: 'assistant', content: aiQuestion },
      { role: 'user', content: buildStudentReplyInstruction() },
    ];

    const result = await callChatCompletion(config, config.model, messages);
    if (!result.success) {
      console.error('LLM API Error:', result.error);
      return result;
    }

    console.log('🤖 LLM 生成回答:', result.content);
    return result;
  } catch (error) {
    console.error('LLM Service Error:', error);
    return { success: false, error: `调用失败: ${(error as Error).message}` };
  }
};

const generateSimulationDialogueRecord = async ({
  trainTaskId,
  profile,
}: SimulationDialogueGenerationParams): Promise<LLMResponse> => {
  const config = normalizeLLMConfig(await llmConfigStorage.get());

  if (!config.apiKey.trim()) {
    return { success: false, error: '请先配置 LLM API Key' };
  }

  try {
    const [stepsResponse, flowResponse] = await Promise.all([
      apiRequest<ApiResponse<ScriptStepItem[]>>({
        endpoint: API_ENDPOINTS.QUERY_SCRIPT_STEP_LIST,
        method: 'POST',
        body: { trainTaskId, trainSubType: 'ability' },
      }),
      apiRequest<ApiResponse<ScriptStepFlow[]>>({
        endpoint: API_ENDPOINTS.QUERY_SCRIPT_STEP_FLOW_LIST,
        method: 'POST',
        body: { trainTaskId },
      }).catch(
        () =>
          ({
            code: 200,
            data: [],
          }) as ApiResponse<ScriptStepFlow[]>,
      ),
    ]);

    const steps = stepsResponse?.data ?? [];
    if (!steps.length) {
      return { success: false, error: '未获取到剧本步骤，无法生成模拟对话' };
    }

    const orderedStages = resolveOrderedScriptStages(steps, flowResponse?.data ?? []);
    if (!orderedStages.length) {
      return { success: false, error: '未识别到默认通关路径上的有效阶段' };
    }

    const messages = buildSimulationDialogueMessages(profile, orderedStages);
    const modelsToTry = await resolveGeneratorModelCandidates(config);
    let lastError = '未找到可用模型';

    for (const model of modelsToTry) {
      const result = await callChatCompletion(config, model, messages, {
        temperature: 0.3,
        maxTokens: Math.max(config.maxTokens, 4096),
      });

      if (result.success) {
        return result;
      }

      lastError = result.error || lastError;
    }

    return { success: false, error: lastError };
  } catch (error) {
    return { success: false, error: `生成失败: ${(error as Error).message}` };
  }
};

/**
 * 测试 LLM 配置是否有效
 */
const testLLMConfig = async (config: LLMConfig): Promise<LLMResponse> => {
  try {
    const normalizedConfig = normalizeLLMConfig(config);
    const response = await fetch(normalizedConfig.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': normalizedConfig.apiKey,
        'service-code': normalizedConfig.serviceCode,
      },
      body: JSON.stringify(
        buildRequestPayload(normalizedConfig, [{ role: 'user', content: '你好，请回复“测试成功”。' }]),
      ),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `API 连接失败: ${response.status}${errorText ? ` - ${errorText}` : ''}` };
    }

    const data = (await response.json()) as LLMApiResponse;
    const content = extractResponseContent(data);

    if (!content) {
      return { success: false, error: '模型未返回有效内容' };
    }

    return { success: true, content };
  } catch (error) {
    return { success: false, error: `连接失败: ${(error as Error).message}` };
  }
};

export {
  fetchAvailableTextModels,
  generateSimulationDialogueRecord,
  generateStudentAnswer,
  normalizeDialogueSimulationContent,
  testLLMConfig,
};
export type { GeneratorProfile, RuntimeProfileOverride };
