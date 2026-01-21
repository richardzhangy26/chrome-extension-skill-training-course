/**
 * LLM 服务 - 调用豆包模型生成回答
 * 参考 Python: auto_script_train.py 中的 _call_doubao_post 方法
 */

import { llmConfigStorage, type LLMConfig } from '@extension/storage';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LLMResponse {
  success: boolean;
  content?: string;
  error?: string;
}

/**
 * 调用豆包模型生成学生回答
 */
export async function generateStudentAnswer(
  aiQuestion: string,
  conversationHistory: Array<{ ai: string; student: string }> = [],
): Promise<LLMResponse> {
  // 获取配置
  const config = await llmConfigStorage.get();

  if (!config.apiKey) {
    return { success: false, error: '请先配置 LLM API Key' };
  }

  try {
    const systemPrompt = `你是一名能力训练助手，需要扮演一个需要引导的学生角色。

## 角色设定
学生档位: 需要引导的学生
角色特征: 基本理解问题但不够全面，回答中会暴露疑惑或请求提示。
表达风格: 语气略显犹豫，能覆盖核心内容，但会提出 1-2 个不确定点或寻求老师建议。

## 问题类型识别（优先级最高）
如果当前问题属于以下类型，请优先直接回答，不需要强制体现性格特点：
1. **确认式问题**: 如'你准备好了吗？请回复是或否'、'确认的话请回复是'
   → 直接回答'是'、'好的'、'确认'等
2. **选择式问题**: 如'你选择A还是B？'、'请选择1/2/3'
   → 直接说出选项，如'我选择A'、'选1'
3. **角色确认问题**: 如'你是学生还是老师？'
   → 直接回答角色，如'学生'

## 输出要求
**优先级1**: 如果是封闭式问题（确认式/选择式/角色确认），直接简短回答
**优先级2**: 如果是开放式问题，适度融入学生档位特点
**格式要求**: 仅返回学生回答内容，不要额外解释，控制在50字以内。`;

    // 构建对话历史
    const historyMessages: ChatMessage[] = [];
    for (const turn of conversationHistory.slice(-5)) { // 只保留最近5轮
      historyMessages.push({ role: 'assistant', content: turn.ai });
      historyMessages.push({ role: 'user', content: turn.student });
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: `当前AI老师的问题是：\n${aiQuestion}\n\n请以学生身份回答：` },
    ];

    // 调用 API
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': config.apiKey,
        'service-code': config.serviceCode,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.7,
        max_tokens: 200,
        top_p: 0.9,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LLM API Error:', response.status, errorText);
      return { success: false, error: `API 请求失败: ${response.status}` };
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return { success: false, error: '模型未返回有效内容' };
    }

    console.log('🤖 LLM 生成回答:', content);
    return { success: true, content };
  } catch (error) {
    console.error('LLM Service Error:', error);
    return { success: false, error: `调用失败: ${(error as Error).message}` };
  }
}

/**
 * 测试 LLM 配置是否有效
 */
export async function testLLMConfig(config: LLMConfig): Promise<LLMResponse> {
  try {
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': config.apiKey,
        'service-code': config.serviceCode,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: '你好' }],
        max_tokens: 10,
      }),
    });

    if (!response.ok) {
      return { success: false, error: `API 连接失败: ${response.status}` };
    }

    return { success: true, content: '配置有效' };
  } catch (error) {
    return { success: false, error: `连接失败: ${(error as Error).message}` };
  }
}
