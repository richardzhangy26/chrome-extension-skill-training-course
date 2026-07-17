import 'webextension-polyfill';
import { toCurrentTrainingTab } from './current-training-tab';
import { readTaskIdFromUrl } from './extract-task-id';
import { createTrainingTabUrlEventController } from './training-tab-url-events';
import { ADMIN_WEB_BASE_URLS, IS_DEV } from '@extension/env';
import { exampleThemeStorage, authSessionStorage, normalizeAuthToken } from '@extension/storage';
import type { CurrentTabInfo } from './current-training-tab';

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

type BackgroundMessageType =
  | 'GET_CURRENT_TAB_URL'
  | 'GET_CURRENT_TAB_INFO'
  | 'GET_AUTH'
  | 'EXTRACT_TRAIN_TASK_ID'
  | 'API_REQUEST'
  | 'ADMIN_WEB_REQUEST';

interface AuthInfo {
  authorization: string | null;
}

interface ApiRequestPayload {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}

interface AdminWebRequestPayload {
  path: string;
  method: 'GET' | 'POST' | 'DELETE';
  body?: Record<string, unknown>;
  auth?: boolean;
}

// ============ 常量 ============
const AUTH_COOKIE_URL = 'https://hike-teaching-center.polymas.com/';
const AUTH_COOKIE_NAME = 'ai-poly';
const API_BASE_URL = 'https://cloudapi.polymas.com';
const ADMIN_WEB_BASE_URL = IS_DEV ? ADMIN_WEB_BASE_URLS.development : ADMIN_WEB_BASE_URLS.production;
const RETRYABLE_HTTP_STATUS = new Set([502, 503, 504]);
const MAX_RETRY_COUNT = 2;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

const handleMessage = async (message: BackgroundMessage): Promise<BackgroundResponse> => {
  switch (message.type) {
    case 'GET_CURRENT_TAB_URL':
      return handleGetCurrentTabUrl();

    case 'GET_CURRENT_TAB_INFO':
      return handleGetCurrentTabInfo();

    case 'GET_AUTH':
      return handleGetAuth();

    case 'EXTRACT_TRAIN_TASK_ID':
      return handleExtractTrainTaskId(message.payload as string);

    case 'API_REQUEST':
      return handleApiRequest(message.payload as ApiRequestPayload);

    case 'ADMIN_WEB_REQUEST':
      return handleAdminWebRequest(message.payload as AdminWebRequestPayload);

    default:
      return { success: false, error: `Unknown message type: ${message.type}` };
  }
};

// ============ 获取当前标签页URL ============
const handleGetCurrentTabUrl = async (): Promise<BackgroundResponse<string>> => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.url) {
      return { success: false, error: 'No active tab found' };
    }

    return { success: true, data: tab.url };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
};

const handleGetCurrentTabInfo = async (): Promise<BackgroundResponse<CurrentTabInfo>> => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tab ? toCurrentTrainingTab(tab) : null;
    if (!currentTab) {
      return { success: false, error: '请打开能力训练 Pro 页面' };
    }
    return { success: true, data: currentTab };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
};

// ============ 获取认证信息 ============
const handleGetAuth = async (): Promise<BackgroundResponse<AuthInfo>> => {
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
};

// ============ 从URL提取trainTaskId ============
const handleExtractTrainTaskId = async (url?: string): Promise<BackgroundResponse<string>> => {
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

    const trainTaskId = readTaskIdFromUrl(targetUrl);

    if (!trainTaskId) {
      return { success: false, error: 'trainTaskId not found in URL' };
    }

    return { success: true, data: trainTaskId };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
};

// ============ API请求代理 ============
const handleApiRequest = async (payload: ApiRequestPayload): Promise<BackgroundResponse<unknown>> => {
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

    for (let attempt = 0; attempt <= MAX_RETRY_COUNT; attempt += 1) {
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        console.log('🔍 API Response:', endpoint, JSON.stringify(data, null, 2));
        return { success: true, data };
      }

      if (RETRYABLE_HTTP_STATUS.has(response.status) && attempt < MAX_RETRY_COUNT) {
        const delayMs = 300 * 2 ** attempt;
        console.warn(
          `⚠️ API 请求异常(${response.status})，${delayMs}ms 后重试（${attempt + 1}/${MAX_RETRY_COUNT}）：${endpoint}`,
        );
        await sleep(delayMs);
        continue;
      }

      const responseText = await response.text();
      const errorSuffix = responseText ? ` - ${responseText.slice(0, 200)}` : '';
      return { success: false, error: `HTTP error: ${response.status}${errorSuffix}` };
    }

    return { success: false, error: 'API request failed after retries' };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
};

// ============ Admin Web 请求代理（bearer，不注入 polymas 认证） ============
const handleAdminWebRequest = async (
  payload: AdminWebRequestPayload,
): Promise<BackgroundResponse<{ status: number; ok: boolean; json: unknown; setAuthToken: string | null }>> => {
  try {
    const { path, method, body, auth } = payload;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    if (auth) {
      const session = await authSessionStorage.get();
      const token = normalizeAuthToken(session.token);
      if (token) {
        // token 是登录响应体里的原始 session token（纯字母数字，传输安全），直接作 bearer。
        // 不要对它做 encode/decode：扩展 Service Worker 的 fetch 对请求头里的 `%xx` 有不稳定解码，
        // 任何百分号编码都可能被损坏（这正是早期用百分号编码的 set-auth-token 报 401 的根因）。
        // 服务端 Better Auth bearer 插件（requireSignature 默认 false）会自行对原始 token 签名校验。
        headers['Authorization'] = `Bearer ${token}`;
        if (session.user && token !== session.token) {
          await authSessionStorage.setSession(token, session.user);
        }
      }
    }

    const url = `${ADMIN_WEB_BASE_URL}${path}`;
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      // Admin Web extension APIs are bearer-authenticated. Do not let same-origin
      // Better Auth cookies override the Authorization header in local/dev Chrome.
      credentials: 'omit',
    });

    if (!response.ok) {
      console.warn(`[admin-web] ${method} ${path} -> ${response.status} (${ADMIN_WEB_BASE_URL})`);
    }

    const setAuthToken = response.headers.get('set-auth-token');
    let json: unknown = null;
    try {
      json = await response.json();
    } catch {
      json = null;
    }

    return {
      success: true,
      data: { status: response.status, ok: response.ok, json, setAuthToken },
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
};

// ============ 监听活动标签页URL变化/切换 ============
const trainingTabUrlEvents = createTrainingTabUrlEventController({
  getTab: tabId => chrome.tabs.get(tabId),
  publish: async tab => {
    await chrome.runtime
      .sendMessage({
        type: 'TAB_URL_CHANGED',
        payload: { tabId: tab.id, url: tab.url },
      })
      .catch(() => {
        // Side Panel可能未打开，忽略错误
      });
  },
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  void trainingTabUrlEvents.onUpdated(tabId, changeInfo, tab);
});

chrome.tabs.onActivated.addListener(activeInfo => {
  void trainingTabUrlEvents.onActivated(activeInfo);
});
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
});
