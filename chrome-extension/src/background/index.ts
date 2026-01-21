import 'webextension-polyfill';
import { exampleThemeStorage } from '@extension/storage';

// ============ 类型定义 ============
interface BackgroundMessage<T = unknown> {
  type: BackgroundMessageType;
  payload?: T;
}

interface BackgroundResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

type BackgroundMessageType = 'GET_CURRENT_TAB_URL' | 'GET_AUTH' | 'EXTRACT_TRAIN_TASK_ID' | 'API_REQUEST';

interface AuthInfo {
  authorization: string | null;
}

interface ApiRequestPayload {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}

// ============ 常量 ============
const AUTH_COOKIE_URL = 'https://hike-teaching-center.polymas.com/';
const AUTH_COOKIE_NAME = 'ai-poly';
const API_BASE_URL = 'https://cloudapi.polymas.com';

// ============ 初始化 ============
exampleThemeStorage.get().then(theme => {
  console.log('theme', theme);
});

chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
});

console.log('Background loaded');

// ============ 消息处理 ============
chrome.runtime.onMessage.addListener(
  (message: BackgroundMessage, _sender, sendResponse: (response: BackgroundResponse) => void) => {
    handleMessage(message)
      .then(sendResponse)
      .catch(error => {
        console.error('Background message handler error:', error);
        sendResponse({ success: false, error: error.message });
      });

    // 返回true表示异步响应
    return true;
  },
);

async function handleMessage(message: BackgroundMessage): Promise<BackgroundResponse> {
  switch (message.type) {
    case 'GET_CURRENT_TAB_URL':
      return handleGetCurrentTabUrl();

    case 'GET_AUTH':
      return handleGetAuth();

    case 'EXTRACT_TRAIN_TASK_ID':
      return handleExtractTrainTaskId(message.payload as string);

    case 'API_REQUEST':
      return handleApiRequest(message.payload as ApiRequestPayload);

    default:
      return { success: false, error: `Unknown message type: ${message.type}` };
  }
}

// ============ 获取当前标签页URL ============
async function handleGetCurrentTabUrl(): Promise<BackgroundResponse<string>> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.url) {
      return { success: false, error: 'No active tab found' };
    }

    return { success: true, data: tab.url };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// ============ 获取认证信息 ============
async function handleGetAuth(): Promise<BackgroundResponse<AuthInfo>> {
  try {
    // 从指定域读取授权 Cookie
    const authCookie = await chrome.cookies.get({
      url: AUTH_COOKIE_URL,
      name: AUTH_COOKIE_NAME,
    });

    return {
      success: true,
      data: {
        authorization: authCookie?.value || null,
      },
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// ============ 从URL提取trainTaskId ============
async function handleExtractTrainTaskId(url?: string): Promise<BackgroundResponse<string>> {
  try {
    let targetUrl = url;

    // 如果没有提供URL，获取当前标签页URL
    if (!targetUrl) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      targetUrl = tab?.url;
    }

    if (!targetUrl) {
      return { success: false, error: 'No URL available' };
    }

    const urlObj = new URL(targetUrl);
    const trainTaskId = urlObj.searchParams.get('trainTaskId');

    if (!trainTaskId) {
      return { success: false, error: 'trainTaskId not found in URL' };
    }

    return { success: true, data: trainTaskId };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// ============ API请求代理 ============
async function handleApiRequest(payload: ApiRequestPayload): Promise<BackgroundResponse<unknown>> {
  try {
    const { endpoint, method, body, headers = {} } = payload;

    // 获取认证信息
    const authResult = await handleGetAuth();
    if (!authResult.success || !authResult.data) {
      console.error('❌ 获取认证信息失败:', authResult.error);
      return { success: false, error: 'Failed to get auth info' };
    }

    const { authorization } = authResult.data;
    console.log('🔐 Authorization:', authorization ? `已获取 (${authorization.substring(0, 20)}...)` : '❌ 未获取');

    // 构建请求头
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    if (authorization) {
      requestHeaders['Authorization'] = authorization;
    }

    // 注意：在Background Script中无法设置Cookie头，但credentials: 'include'会自动携带Cookie
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
    });

    if (!response.ok) {
      return { success: false, error: `HTTP error: ${response.status}` };
    }

    const data = await response.json();
    console.log('🔍 API Response:', endpoint, JSON.stringify(data, null, 2));
    return { success: true, data };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// ============ 监听标签页URL变化 ============
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && tab.url?.includes('hike-teaching-center.polymas.com')) {
    // 通知Side Panel URL已变化
    chrome.runtime.sendMessage({
      type: 'TAB_URL_CHANGED',
      payload: { tabId, url: changeInfo.url },
    }).catch(() => {
      // Side Panel可能未打开，忽略错误
    });
  }
});
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
});
