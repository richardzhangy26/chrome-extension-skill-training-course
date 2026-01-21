/**
 * Background通信桥接层
 * 封装与Background Script的通信
 */

interface BackgroundResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

interface AuthInfo {
  authorization: string | null;
  cookies: string;
}

interface ApiRequestPayload {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}

// 发送消息到Background Script
async function sendMessage<T>(type: string, payload?: unknown): Promise<BackgroundResponse<T>> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, payload }, (response: BackgroundResponse<T>) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message });
      } else {
        resolve(response);
      }
    });
  });
}

// 获取当前标签页URL
export async function getCurrentTabUrl(): Promise<string | null> {
  const response = await sendMessage<string>('GET_CURRENT_TAB_URL');
  return response.success ? response.data ?? null : null;
}

// 获取认证信息
export async function getAuth(): Promise<AuthInfo | null> {
  const response = await sendMessage<AuthInfo>('GET_AUTH');
  return response.success ? response.data ?? null : null;
}

// 从URL提取trainTaskId
export async function extractTrainTaskId(url?: string): Promise<string | null> {
  const response = await sendMessage<string>('EXTRACT_TRAIN_TASK_ID', url);
  return response.success ? response.data ?? null : null;
}

// API请求代理
export async function apiRequest<T>(payload: ApiRequestPayload): Promise<T | null> {
  const response = await sendMessage<T>('API_REQUEST', payload);
  if (!response.success) {
    console.error('API request failed:', response.error);
    return null;
  }
  return response.data ?? null;
}

// 监听URL变化
export function onTabUrlChanged(callback: (url: string) => void): () => void {
  const handler = (message: { type: string; payload?: { url: string } }) => {
    if (message.type === 'TAB_URL_CHANGED' && message.payload?.url) {
      callback(message.payload.url);
    }
  };

  chrome.runtime.onMessage.addListener(handler);
  return () => chrome.runtime.onMessage.removeListener(handler);
}

// API端点常量
export const API_ENDPOINTS = {
  QUERY_SCRIPT_STEP_LIST: '/teacher-course/abilityTrain/queryScriptStepList',
  QUERY_SCRIPT_STEP_FLOW_LIST: '/teacher-course/abilityTrain/queryScriptStepFlowList',
  RUN_CARD: '/ai-tools/trainRun/runCard',
  CHAT: '/ai-tools/trainRun/chat',
} as const;
