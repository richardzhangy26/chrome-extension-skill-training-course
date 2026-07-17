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

interface CurrentTabInfo {
  id: number;
  url: string;
}

interface ApiRequestPayload {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}

interface ApiBusinessEnvelope {
  code?: unknown;
  msg?: unknown;
  message?: unknown;
  error?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const resolveBusinessErrorMessage = (envelope: ApiBusinessEnvelope) => {
  const candidates = [envelope.msg, envelope.message, envelope.error];
  const message = candidates.find(candidate => typeof candidate === 'string' && candidate.trim().length > 0);
  return typeof message === 'string' ? message : 'API 业务错误';
};

// 发送消息到Background Script
const sendMessage = async <T>(type: string, payload?: unknown): Promise<BackgroundResponse<T>> =>
  new Promise(resolve => {
    chrome.runtime.sendMessage({ type, payload }, (response: BackgroundResponse<T>) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message });
      } else {
        resolve(response);
      }
    });
  });

// 获取当前标签页URL
const getCurrentTabUrl = async (): Promise<string | null> => {
  const response = await sendMessage<string>('GET_CURRENT_TAB_URL');
  return response.success ? (response.data ?? null) : null;
};

const getCurrentTabInfo = async (): Promise<CurrentTabInfo> => {
  const response = await sendMessage<CurrentTabInfo>('GET_CURRENT_TAB_INFO');
  if (!response.success || !response.data) {
    throw new Error(response.error || '请打开能力训练 Pro 页面');
  }
  return response.data;
};

const connectProTrainV2Page = async (): Promise<chrome.runtime.Port> => {
  const tab = await getCurrentTabInfo();
  return chrome.tabs.connect(tab.id, { name: 'polymas-pro-train-v2', frameId: 0 });
};

// 获取认证信息
const getAuth = async (): Promise<AuthInfo | null> => {
  const response = await sendMessage<AuthInfo>('GET_AUTH');
  return response.success ? (response.data ?? null) : null;
};

// 从URL提取trainTaskId
const extractTrainTaskId = async (url?: string): Promise<string | null> => {
  const response = await sendMessage<string>('EXTRACT_TRAIN_TASK_ID', url);
  return response.success ? (response.data ?? null) : null;
};

// API请求代理
const apiRequest = async <T>(payload: ApiRequestPayload): Promise<T> => {
  const response = await sendMessage<T>('API_REQUEST', payload);
  if (!response.success) {
    console.error('API request failed:', response.error);
    throw new Error(response.error || 'API request failed');
  }
  if (response.data === undefined || response.data === null) {
    throw new Error('API request returned empty response');
  }

  if (isRecord(response.data)) {
    const envelope = response.data as ApiBusinessEnvelope;
    if (typeof envelope.code === 'number' && envelope.code !== 200) {
      throw new Error(resolveBusinessErrorMessage(envelope));
    }
  }

  return response.data;
};

interface AdminWebRequestPayload {
  path: string;
  method: 'GET' | 'POST' | 'DELETE';
  body?: Record<string, unknown>;
  auth?: boolean;
}

interface AdminWebResponse {
  status: number;
  ok: boolean;
  json: unknown;
  setAuthToken: string | null;
}

const adminWebRequest = async (payload: AdminWebRequestPayload): Promise<AdminWebResponse> => {
  const response = await sendMessage<AdminWebResponse>('ADMIN_WEB_REQUEST', payload);
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Admin Web request failed');
  }
  return response.data;
};

// 监听URL变化
const onTabUrlChanged = (callback: (url: string) => void): (() => void) => {
  const handler = (message: { type: string; payload?: { url: string } }) => {
    if (message.type === 'TAB_URL_CHANGED' && message.payload?.url) {
      callback(message.payload.url);
    }
  };

  chrome.runtime.onMessage.addListener(handler);
  return () => chrome.runtime.onMessage.removeListener(handler);
};

// API端点常量
const API_ENDPOINTS = {
  QUERY_SCRIPT_STEP_LIST: '/teacher-course/abilityTrain/queryScriptStepList',
  QUERY_SCRIPT_STEP_FLOW_LIST: '/teacher-course/abilityTrain/queryScriptStepFlowList',
  QUERY_CONFIGURATION: '/teacher-course/abilityTrain/queryConfiguration',
  RUN_CARD: '/ai-tools/trainRun/runCard',
  CHAT: '/ai-tools/trainRun/chat',
} as const;

export {
  getCurrentTabUrl,
  getAuth,
  extractTrainTaskId,
  apiRequest,
  onTabUrlChanged,
  API_ENDPOINTS,
  adminWebRequest,
  getCurrentTabInfo,
  connectProTrainV2Page,
};
export type { AdminWebRequestPayload, AdminWebResponse, CurrentTabInfo };
