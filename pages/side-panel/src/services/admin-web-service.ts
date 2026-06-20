/**
 * Admin Web 联动服务：登录/注册/会话/配置同步。
 * 经 background ADMIN_WEB_REQUEST 代理直连 Admin Web。
 */

import { adminWebRequest } from './background-bridge';
import { authSessionStorage } from '@extension/storage';
import type { AuthUser, LLMConfig } from '@extension/storage';

interface AuthResult {
  ok: boolean;
  error?: string;
  needsVerification?: boolean;
}

const extractUser = (json: unknown): AuthUser | null => {
  if (!json || typeof json !== 'object') {
    return null;
  }
  const u = (json as { user?: { id?: string; email?: string; name?: string } }).user;
  if (!u?.id || !u.email) {
    return null;
  }
  return { id: u.id, email: u.email, name: u.name ?? '' };
};

const signUp = async (input: { email: string; password: string; name: string }): Promise<AuthResult> => {
  const res = await adminWebRequest({
    path: '/api/auth/sign-up/email',
    method: 'POST',
    body: input,
  });
  if (!res.ok) {
    const msg = (res.json as { message?: string })?.message ?? `注册失败(${res.status})`;
    return { ok: false, error: msg };
  }
  // 开启了邮箱验证：注册成功但需先去邮箱验证再登录
  return { ok: true, needsVerification: true };
};

const signIn = async (input: { email: string; password: string }): Promise<AuthResult> => {
  const res = await adminWebRequest({
    path: '/api/auth/sign-in/email',
    method: 'POST',
    body: input,
  });
  if (!res.ok) {
    if (res.status === 403) {
      return { ok: false, needsVerification: true, error: '邮箱尚未验证，请先到邮箱完成验证' };
    }
    const msg = (res.json as { message?: string })?.message ?? `登录失败(${res.status})`;
    return { ok: false, error: msg };
  }
  const user = extractUser(res.json);
  if (!res.setAuthToken || !user) {
    return { ok: false, error: '登录响应缺少令牌或用户信息' };
  }
  await authSessionStorage.setSession(res.setAuthToken, user);
  return { ok: true };
};

const signOut = async (): Promise<void> => {
  try {
    await adminWebRequest({ path: '/api/auth/sign-out', method: 'POST', auth: true });
  } catch {
    // 网络失败也要本地登出
  }
  await authSessionStorage.clear();
};

const getSession = async (): Promise<AuthUser | null> => {
  const res = await adminWebRequest({ path: '/api/auth/get-session', method: 'GET', auth: true });
  if (!res.ok) {
    if (res.status === 401) {
      await authSessionStorage.clear();
    }
    return null;
  }
  const user = extractUser(res.json);
  if (!user) {
    // 200 + 空/null body：会话已不存在或过期（Better Auth 不返回 401）
    await authSessionStorage.clear();
    return null;
  }
  return user;
};

type FetchConfigResult = { ok: true; config: LLMConfig | null } | { ok: false };

const fetchLlmConfig = async (): Promise<FetchConfigResult> => {
  const res = await adminWebRequest({ path: '/api/extension/config', method: 'GET', auth: true });
  if (!res.ok) {
    if (res.status === 401) {
      await authSessionStorage.clear();
    }
    return { ok: false };
  }
  return { ok: true, config: (res.json as { config?: LLMConfig | null }).config ?? null };
};

const pushLlmConfig = async (config: LLMConfig): Promise<boolean> => {
  const res = await adminWebRequest({
    path: '/api/extension/config',
    method: 'POST',
    auth: true,
    body: config as unknown as Record<string, unknown>,
  });
  return res.ok;
};

export { signUp, signIn, signOut, getSession, fetchLlmConfig, pushLlmConfig };
export type { AuthResult };
