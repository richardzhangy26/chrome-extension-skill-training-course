/**
 * LLM 服务 - 调用 LLM 模型生成回答
 * 参考 Python: auto_script_train.py 中的 _call_doubao_post 方法
 */

import { apiRequest, API_ENDPOINTS } from './background-bridge';
import { assertHostPermission } from './host-permission-service';
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_PROFILE_ID, llmConfigStorage, normalizeLLMConfig } from '@extension/storage';
import type { RoleRuntimeConfig } from '../types/multi-role-types';
import type { LLMConfig, StudentProfile } from '@extension/storage';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LLMResponse {
  success: boolean;
  content?: string;
  error?: string;
  finishReason?: string | null;
}

interface LLMApiResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
    finish_reason?: string | null;
    finishReason?: string | null;
  }>;
}

interface ChatCompletionRequestPayload {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens: number;
  top_k?: number;
}

interface ChatCompletionRequestOptions {
  temperature?: number;
  maxTokens?: number;
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

type PresetGeneratorProfile = 'good' | 'medium' | 'poor';
type GeneratorProfile = PresetGeneratorProfile | 'custom';

interface RuntimeProfileOverride {
  profile: StudentProfile;
  runtimeConfigOverride?: RoleRuntimeConfig;
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
  /** profile === 'custom' 时必填，例如「好学生走 A 路径」 */
  customInstruction?: string;
  onProgress?: (progress: SimulationGenerationProgress) => void;
}

interface SimulationGenerationProgress {
  current: number;
  total: number;
  stageName: string;
  isRetry?: boolean;
}

interface StageDialogueGenerationParams {
  config: LLMConfig;
  profile: GeneratorProfile;
  stage: DialogueGeneratorStage;
  stageIndex: number;
  totalStages: number;
  modelsToTry: string[];
  isConciseRetry?: boolean;
  customInstruction?: string;
}

interface CustomPathPlanningParams {
  config: LLMConfig;
  modelsToTry: string[];
  steps: ScriptStepItem[];
  flows: ScriptStepFlow[];
  customInstruction: string;
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

const GENERATOR_PROFILE_LABELS: Record<PresetGeneratorProfile, string> = {
  good: '好学生',
  medium: '一般学生',
  poor: '差学生',
};

const GENERATOR_PROFILE_GUIDANCE: Record<PresetGeneratorProfile, string> = {
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

const DEFAULT_SAMPLING_ONLY_MODEL_PATTERNS = [
  /(^|[/\-_.\s])gpt[-_\s]?5(?:[-_\s.]|$)/i,
  /(^|[/\-_.\s])o[134](?:[-_\s.]|$)/i,
  /reasoning/i,
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

const requiresDefaultSamplingParameters = (model: string) =>
  DEFAULT_SAMPLING_ONLY_MODEL_PATTERNS.some(pattern => pattern.test(model.trim()));

const buildChatCompletionPayload = (
  config: Pick<LLMConfig, 'temperature' | 'topK' | 'maxTokens'>,
  model: string,
  messages: ChatMessage[],
  options: ChatCompletionRequestOptions = {},
): ChatCompletionRequestPayload => {
  const payload: ChatCompletionRequestPayload = {
    model,
    messages,
    max_tokens: options.maxTokens ?? config.maxTokens,
  };

  if (!requiresDefaultSamplingParameters(model)) {
    payload.temperature = options.temperature ?? config.temperature;
    payload.top_k = config.topK;
  }

  return payload;
};

const callChatCompletion = async (
  config: Pick<LLMConfig, 'apiUrl' | 'apiKey' | 'serviceCode' | 'temperature' | 'topK' | 'maxTokens'>,
  model: string,
  messages: ChatMessage[],
  options?: ChatCompletionRequestOptions,
): Promise<LLMResponse> => {
  try {
    await assertHostPermission(config.apiUrl);
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: buildTextModelHeaders(config),
      body: JSON.stringify(buildChatCompletionPayload(config, model, messages, options)),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `API 请求失败: ${response.status}${errorText ? ` - ${errorText}` : ''}` };
    }

    const data = (await response.json()) as LLMApiResponse;
    const content = extractResponseContent(data);

    const finishReason = extractResponseFinishReason(data);

    if (!content) {
      return {
        success: false,
        error: finishReason === 'length' ? '模型输出因长度限制被截断' : '模型未返回有效内容',
        finishReason,
      };
    }

    return { success: true, content, finishReason };
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

const toDialogueGeneratorStage = (step: ScriptStepItem): DialogueGeneratorStage => ({
  stepId: step.stepId,
  stepName: step.stepDetailDTO?.stepName?.trim() || step.stepId,
  interactiveRounds: Math.max(0, step.stepDetailDTO?.interactiveRounds ?? 0),
  prologue: step.stepDetailDTO?.prologue?.trim() || '',
  description: step.stepDetailDTO?.description?.trim() || '',
  llmPrompt: step.stepDetailDTO?.llmPrompt?.trim() || '',
  trainerName: step.stepDetailDTO?.trainerName?.trim() || '',
});

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
        nodeStages.push(toDialogueGeneratorStage(nextStep));
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
    .map(toDialogueGeneratorStage);
};

const hasBranchingFlows = (flows: ScriptStepFlow[]) => {
  const outgoingCounts = new Map<string, number>();
  for (const flow of flows) {
    outgoingCounts.set(flow.scriptStepStartId, (outgoingCounts.get(flow.scriptStepStartId) ?? 0) + 1);
  }

  return [...outgoingCounts.values()].some(count => count > 1);
};

const buildFlowGraphDescription = (steps: ScriptStepItem[], flows: ScriptStepFlow[]) => {
  const stepLines = steps.map(step => {
    const detail = step.stepDetailDTO;
    const description = detail?.description?.trim().slice(0, 60) || '(无描述)';

    return `- ${step.stepId} | ${detail?.stepName?.trim() || '(未命名)'} | 类型: ${detail?.nodeType ?? 'UNKNOWN'} | 描述: ${description}`;
  });
  const flowLines = flows.map(
    flow => `- ${flow.scriptStepStartId} -> ${flow.scriptStepEndId}${flow.isDefault === 1 ? ' (默认连线)' : ''}`,
  );

  return ['节点列表：', ...stepLines, '', '连线列表：', ...flowLines].join('\n');
};

const buildPathPlanningMessages = (graphDescription: string, customInstruction: string): ChatMessage[] => [
  {
    role: 'system',
    content: [
      '你是训练剧本路径规划器。',
      '给你一个剧本流程图（节点列表 + 有向连线列表）和一条自定义生成要求。',
      '请从 SCRIPT_START 节点出发，沿连线方向选出一条最符合自定义要求的完整路径。',
      '只输出一个 JSON 数组：路径上按顺序排列的 SCRIPT_NODE 节点 stepId，不包含 SCRIPT_START 和 SCRIPT_END。',
      '不要输出解释、代码块标记或其他任何内容。',
    ].join('\n'),
  },
  {
    role: 'user',
    content: [`自定义生成要求：${customInstruction}`, '', graphDescription].join('\n'),
  },
];

const parsePlannedStepIds = (content: string): string[] | null => {
  try {
    const parsed = JSON.parse(normalizeGeneratedDialogueBlock(content)) as unknown;
    if (!Array.isArray(parsed) || !parsed.length) {
      return null;
    }
    if (!parsed.every((item): item is string => typeof item === 'string' && Boolean(item.trim()))) {
      return null;
    }

    const ids = parsed.map(item => item.trim());
    return new Set(ids).size === ids.length ? ids : null;
  } catch {
    return null;
  }
};

const resolveCustomScriptStages = async ({
  config,
  modelsToTry,
  steps,
  flows,
  customInstruction,
}: CustomPathPlanningParams): Promise<DialogueGeneratorStage[] | null> => {
  const stepMap = new Map(steps.map(step => [step.stepId, step]));
  const startStepId = steps.find(step => step.stepDetailDTO?.nodeType === 'SCRIPT_START')?.stepId;
  if (!startStepId) {
    return null;
  }

  const adjacency = new Set(flows.map(flow => `${flow.scriptStepStartId}->${flow.scriptStepEndId}`));
  const messages = buildPathPlanningMessages(buildFlowGraphDescription(steps, flows), customInstruction);

  for (const model of modelsToTry) {
    const result = await callChatCompletion(config, model, messages, { temperature: 0, maxTokens: 1024 });
    if (!result.success || !result.content) {
      continue;
    }

    const plannedStepIds = parsePlannedStepIds(result.content);
    if (!plannedStepIds) {
      continue;
    }

    const allNodesValid = plannedStepIds.every(
      stepId => stepMap.get(stepId)?.stepDetailDTO?.nodeType === 'SCRIPT_NODE',
    );
    const pathConnected =
      adjacency.has(`${startStepId}->${plannedStepIds[0]}`) &&
      plannedStepIds.slice(1).every((stepId, index) => adjacency.has(`${plannedStepIds[index]}->${stepId}`));

    if (allNodesValid && pathConnected) {
      return plannedStepIds.flatMap(stepId => {
        const step = stepMap.get(stepId);
        return step ? [toDialogueGeneratorStage(step)] : [];
      });
    }
  }

  console.warn('自定义路径规划失败，回退默认通关路径。');
  return null;
};

const buildSimulationStageDialogueMessages = (
  profile: GeneratorProfile,
  stage: DialogueGeneratorStage,
  stageIndex: number,
  totalStages: number,
  isConciseRetry = false,
  customInstruction = '',
): ChatMessage[] => {
  const maxRounds = Math.max(1, stage.interactiveRounds);
  const roundInstruction = isConciseRetry
    ? `只生成 1 轮。AI 和用户回答都必须非常短，优先保证完整闭合，不要超过 ${maxRounds} 轮上限。`
    : `生成 1 到 ${maxRounds} 轮，不要超过 interactiveRounds 上限；如果 interactiveRounds 为 0，也生成 1 轮用于保留阶段记录。`;

  const profileLines =
    profile === 'custom'
      ? ['当前生成模式：自定义提示词', `自定义生成要求：${customInstruction.trim() || '(未提供)'}`]
      : [
          `当前要生成的学生档位：${GENERATOR_PROFILE_LABELS[profile]} (${profile})`,
          GENERATOR_PROFILE_GUIDANCE[profile],
        ];

  const constraintLines =
    profile === 'custom'
      ? [
          '1. 学生行为、答题质量与路径选择必须严格符合上面的自定义生成要求。',
          '2. AI 话术必须贴合该阶段的 llmPrompt、角色设定和开场白。',
          '3. 用户回答必须符合自定义生成要求，且围绕阶段目标推进。',
        ]
      : [
          '1. 好学生走最佳通关路线，尽量用最少轮次达标；一般学生保留被引导过程；差学生可用于边界测试，不强制通关。',
          '2. AI 话术必须贴合该阶段的 llmPrompt、角色设定和开场白。',
          '3. 用户回答必须符合档位特点，且围绕阶段目标推进。',
        ];

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
        '每一轮都必须包含上述 4 行，不能缺少分隔线。',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        ...profileLines,
        '',
        `当前只生成第 ${stageIndex + 1}/${totalStages} 阶段，禁止输出其他阶段。`,
        `轮次要求：${roundInstruction}`,
        '',
        '生成约束：',
        ...constraintLines,
        '4. 输出中不要使用 Markdown 标题、列表、代码块或解释性文字。',
        '5. 每一轮 Step 行中的 stepName 与 step_id 必须使用下方真实值。',
        ...(isConciseRetry ? ['6. 这是截断后的精简重试：压缩表达，只保留达标所需的最短问答。'] : []),
        '',
        '阶段配置：',
        `stepId: ${stage.stepId}`,
        `stepName: ${stage.stepName}`,
        `trainerName: ${stage.trainerName || '未提供'}`,
        `interactiveRounds: ${stage.interactiveRounds}`,
        'prologue:',
        stage.prologue || '(无)',
        'description:',
        stage.description || '(无)',
        'llmPrompt:',
        stage.llmPrompt || '(无)',
      ].join('\n'),
    },
  ];
};

const normalizeGeneratedDialogueBlock = (content: string) =>
  content
    .trim()
    .replace(/^```(?:text|txt|markdown)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

const buildStageTruncationError = (stage: DialogueGeneratorStage, stageIndex: number) =>
  `第 ${stageIndex + 1} 阶段「${stage.stepName}」生成被截断，请缩短该阶段剧本或降低生成轮数后重试。`;

const generateSimulationDialogueStage = async ({
  config,
  profile,
  stage,
  stageIndex,
  totalStages,
  modelsToTry,
  isConciseRetry = false,
  customInstruction = '',
}: StageDialogueGenerationParams): Promise<LLMResponse> => {
  const messages = buildSimulationStageDialogueMessages(
    profile,
    stage,
    stageIndex,
    totalStages,
    isConciseRetry,
    customInstruction,
  );
  let lastError = '未找到可用模型';
  let truncatedResult: LLMResponse | null = null;

  for (const model of modelsToTry) {
    const result = await callChatCompletion(config, model, messages, {
      temperature: isConciseRetry ? 0.2 : 0.3,
      maxTokens: Math.max(config.maxTokens, isConciseRetry ? 2048 : 4096),
    });

    if (result.success && result.content && result.finishReason !== 'length') {
      return {
        ...result,
        content: normalizeGeneratedDialogueBlock(result.content),
      };
    }

    if (result.finishReason === 'length') {
      truncatedResult = result;
      lastError = '模型输出因长度限制被截断';
      continue;
    }

    lastError = result.error || lastError;
  }

  return truncatedResult ?? { success: false, error: lastError };
};

const buildStudentRoleSystemPrompt = (
  systemPrompt: string,
  profile: { label: string; description: string; style: string; fallbackHint?: string },
  config: Pick<
    LLMConfig,
    'dialogueSimulationEnabled' | 'dialogueSimulationContent' | 'knowledgeBaseEnabled' | 'knowledgeBaseContent'
  >,
  runtimeConfigOverride?: RoleRuntimeConfig,
) => {
  const effectiveDialogueEnabled = runtimeConfigOverride?.dialogueSimulationEnabled ?? config.dialogueSimulationEnabled;
  const effectiveDialogueContent = runtimeConfigOverride?.dialogueSimulationContent ?? config.dialogueSimulationContent;
  const effectiveKnowledgeEnabled = runtimeConfigOverride?.knowledgeBaseEnabled ?? config.knowledgeBaseEnabled;
  const effectiveKnowledgeContent = runtimeConfigOverride?.knowledgeBaseContent ?? config.knowledgeBaseContent;

  const dialogueSimulationContent = effectiveDialogueEnabled
    ? normalizeDialogueSimulationContent(effectiveDialogueContent)
    : '';
  const fallbackHint = profile.fallbackHint?.trim();

  const sections = [
    systemPrompt,
    '',
    '## 当前扮演设定',
    `学生档位: ${profile.label}`,
    `角色特征: ${profile.description || '未提供'}`,
    `表达风格: ${profile.style || '未提供'}`,
    fallbackHint
      ? `兜底要求: ${fallbackHint}`
      : '兜底要求: 当示例对话或知识库没有匹配内容时，仍需严格按上述角色特征和表达风格组织学生回答。',
    '',
  ];

  if (dialogueSimulationContent) {
    sections.push(
      '## 档位示例对话（优先级最高）',
      '当训练师的提问与示例对话中的场景匹配时，必须优先引用或改写示例中的学生回答，不要自行发挥。',
      '当示例对话没有匹配场景时，必须回到上方角色特征、表达风格和兜底要求来回答。',
      dialogueSimulationContent,
      '',
    );
  }

  const knowledgeBaseContent = effectiveKnowledgeEnabled ? effectiveKnowledgeContent.trim() : '';
  if (knowledgeBaseContent) {
    sections.push(
      '## 参考知识库（次优先级）',
      '当示例对话中没有匹配的场景时，参考以下知识库内容来组织回答。',
      knowledgeBaseContent,
      '',
    );
  }

  sections.push(
    '## 回复规则',
    '你将收到训练师（user）的提问，请直接以学生身份回复。',
    '如果训练师让你做选择、确认或补充内容，请直接作答。',
    '仅输出学生回答内容，不要添加角色标签，不要额外解释。',
  );

  return sections.join('\n');
};

const extractResponseContent = (data: LLMApiResponse) => data.choices?.[0]?.message?.content?.trim();

const extractResponseFinishReason = (data: LLMApiResponse) =>
  data.choices?.[0]?.finish_reason ?? data.choices?.[0]?.finishReason ?? null;

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

  await assertHostPermission(modelsUrl);
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
    const roleSystemPrompt = buildStudentRoleSystemPrompt(
      systemPrompt,
      profile,
      config,
      runtimeOverride?.runtimeConfigOverride,
    );

    const historyMessages: ChatMessage[] = [];
    for (const turn of conversationHistory.slice(-config.maxHistoryRounds)) {
      historyMessages.push({ role: 'user', content: turn.ai });
      historyMessages.push({ role: 'assistant', content: turn.student });
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: roleSystemPrompt },
      ...historyMessages,
      { role: 'user', content: aiQuestion },
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
  customInstruction,
  onProgress,
}: SimulationDialogueGenerationParams): Promise<LLMResponse> => {
  const config = normalizeLLMConfig(await llmConfigStorage.get());

  if (!config.apiKey.trim()) {
    return { success: false, error: '请先配置 LLM API Key' };
  }

  const trimmedCustomInstruction = customInstruction?.trim() ?? '';
  if (profile === 'custom' && !trimmedCustomInstruction) {
    return { success: false, error: '自定义生成模式需要填写生成要求。' };
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

    const flows = flowResponse?.data ?? [];
    const modelsToTry = await resolveGeneratorModelCandidates(config);

    let orderedStages = resolveOrderedScriptStages(steps, flows);
    if (profile === 'custom' && hasBranchingFlows(flows)) {
      const plannedStages = await resolveCustomScriptStages({
        config,
        modelsToTry,
        steps,
        flows,
        customInstruction: trimmedCustomInstruction,
      });
      if (plannedStages?.length) {
        orderedStages = plannedStages;
      }
    }

    if (!orderedStages.length) {
      return { success: false, error: '未识别到默认通关路径上的有效阶段' };
    }

    const generatedBlocks: string[] = [];

    for (const [stageIndex, stage] of orderedStages.entries()) {
      onProgress?.({
        current: stageIndex + 1,
        total: orderedStages.length,
        stageName: stage.stepName,
      });

      let stageResult = await generateSimulationDialogueStage({
        config,
        profile,
        stage,
        stageIndex,
        totalStages: orderedStages.length,
        modelsToTry,
        customInstruction: trimmedCustomInstruction,
      });

      if (stageResult.finishReason === 'length') {
        onProgress?.({
          current: stageIndex + 1,
          total: orderedStages.length,
          stageName: stage.stepName,
          isRetry: true,
        });

        stageResult = await generateSimulationDialogueStage({
          config,
          profile,
          stage,
          stageIndex,
          totalStages: orderedStages.length,
          modelsToTry,
          isConciseRetry: true,
          customInstruction: trimmedCustomInstruction,
        });

        if (stageResult.finishReason === 'length') {
          stageResult = {
            success: false,
            error: buildStageTruncationError(stage, stageIndex),
            finishReason: 'length',
          };
        }
      }

      if (!stageResult.success || !stageResult.content) {
        return {
          success: false,
          error: stageResult.error || `第 ${stageIndex + 1} 阶段「${stage.stepName}」生成失败`,
          finishReason: stageResult.finishReason,
        };
      }

      generatedBlocks.push(stageResult.content);
    }

    return { success: true, content: generatedBlocks.join('\n\n') };
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
    await assertHostPermission(normalizedConfig.apiUrl);
    const response = await fetch(normalizedConfig.apiUrl, {
      method: 'POST',
      headers: buildTextModelHeaders(normalizedConfig),
      body: JSON.stringify(
        buildChatCompletionPayload(normalizedConfig, normalizedConfig.model, [
          { role: 'user', content: '你好，请回复“测试成功”。' },
        ]),
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
export type { GeneratorProfile, RuntimeProfileOverride, SimulationGenerationProgress };
