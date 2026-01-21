/**
 * API客户端封装
 * 遵循依赖倒置原则，依赖抽象而非具体实现
 */

import { API_BASE_URL, API_ENDPOINTS } from './constants.js';
import type {
  ApiResponse,
  ScriptStep,
  ScriptStepFlow,
  RunCardResponse,
  ChatResponse,
  AuthInfo,
  QueryScriptStepListRequest,
  QueryScriptStepFlowListRequest,
  RunCardRequest,
  ChatRequest,
} from './types.js';

// 抽象的HTTP客户端接口
export interface HttpClient {
  post<T>(url: string, body: unknown, headers?: Record<string, string>): Promise<T>;
}

// 默认的fetch实现
export class FetchHttpClient implements HttpClient {
  async post<T>(url: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }
}

// API客户端类
export class AgentApiClient {
  private httpClient: HttpClient;
  private authInfo: AuthInfo | null = null;

  constructor(httpClient: HttpClient = new FetchHttpClient()) {
    this.httpClient = httpClient;
  }

  setAuthInfo(authInfo: AuthInfo): void {
    this.authInfo = authInfo;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.authInfo?.authorization) {
      headers['Authorization'] = this.authInfo.authorization;
    }
    if (this.authInfo?.cookies) {
      headers['Cookie'] = this.authInfo.cookies;
    }
    return headers;
  }

  async queryScriptStepList(request: QueryScriptStepListRequest): Promise<ApiResponse<ScriptStep[]>> {
    const url = `${API_BASE_URL}${API_ENDPOINTS.QUERY_SCRIPT_STEP_LIST}`;
    return this.httpClient.post(url, request, this.getHeaders());
  }

  async queryScriptStepFlowList(request: QueryScriptStepFlowListRequest): Promise<ApiResponse<ScriptStepFlow[]>> {
    const url = `${API_BASE_URL}${API_ENDPOINTS.QUERY_SCRIPT_STEP_FLOW_LIST}`;
    return this.httpClient.post(url, request, this.getHeaders());
  }

  async runCard(request: RunCardRequest): Promise<ApiResponse<RunCardResponse>> {
    const url = `${API_BASE_URL}${API_ENDPOINTS.RUN_CARD}`;
    return this.httpClient.post(url, request, this.getHeaders());
  }

  async chat(request: ChatRequest): Promise<ApiResponse<ChatResponse>> {
    const url = `${API_BASE_URL}${API_ENDPOINTS.CHAT}`;
    return this.httpClient.post(url, request, this.getHeaders());
  }
}

// 创建API客户端实例的工厂函数
export function createAgentApiClient(httpClient?: HttpClient): AgentApiClient {
  return new AgentApiClient(httpClient);
}
