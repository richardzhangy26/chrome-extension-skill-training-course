/**
 * LLM 服务 - 调用豆包模型生成回答
 * 参考 Python: auto_script_train.py 中的 _call_doubao_post 方法
 */

import { DEFAULT_SYSTEM_PROMPT, DEFAULT_PROFILE_ID, llmConfigStorage, normalizeLLMConfig } from '@extension/storage';
import type { LLMConfig } from '@extension/storage';

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

const buildUserMessage = (aiQuestion: string, profile: { label: string; description: string; style: string }) => {
  const sections = [
    '## 角色设定',
    `学生档位: ${profile.label}`,
    `角色特征: ${profile.description}`,
    `表达风格: ${profile.style}`,
    '',
  ];

  sections.push('## 当前问题', aiQuestion, '');

  return sections.join('\n');
};

const buildRequestPayload = (config: LLMConfig, messages: ChatMessage[]) => ({
  model: config.model,
  messages,
  temperature: config.temperature,
  max_tokens: config.maxTokens,
  top_k: config.topK,
});

const extractResponseContent = (data: LLMApiResponse) => data.choices?.[0]?.message?.content?.trim();

/**
 * 调用豆包模型生成学生回答
 */
const generateStudentAnswer = async (
  aiQuestion: string,
  conversationHistory: Array<{ ai: string; student: string }> = [],
): Promise<LLMResponse> => {
  // 获取配置
  const config = normalizeLLMConfig(await llmConfigStorage.get());

  if (!config.apiKey) {
    return { success: false, error: '请先配置 LLM API Key' };
  }

  try {
    const systemPrompt = resolveSystemPrompt(config);
    const profile = resolveStudentProfile(config);
    const userMessage = buildUserMessage(aiQuestion, profile);

    const historyMessages: ChatMessage[] = [];
    for (const turn of conversationHistory.slice(-5)) {
      historyMessages.push({ role: 'assistant', content: turn.ai });
      historyMessages.push({ role: 'user', content: turn.student });
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: userMessage },
    ];

    // 调用 API
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': config.apiKey,
        'service-code': config.serviceCode,
      },
      body: JSON.stringify(buildRequestPayload(config, messages)),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LLM API Error:', response.status, errorText);
      return { success: false, error: `API 请求失败: ${response.status}` };
    }

    const data = (await response.json()) as LLMApiResponse;
    const content = extractResponseContent(data);

    if (!content) {
      return { success: false, error: '模型未返回有效内容' };
    }

    console.log('🤖 LLM 生成回答:', content);
    return { success: true, content };
  } catch (error) {
    console.error('LLM Service Error:', error);
    return { success: false, error: `调用失败: ${(error as Error).message}` };
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

export { generateStudentAnswer, testLLMConfig };
