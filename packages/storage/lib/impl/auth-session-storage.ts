/**
 * 登录会话存储：保存 Admin Web 的 bearer token 与用户信息。
 */

import { createStorage, StorageEnum } from '../base/index.js';
import type { BaseStorageType } from '../base/index.js';

interface AuthUser {
  id: string;
  email: string;
  name: string;
}

interface AuthSession {
  token: string | null;
  user: AuthUser | null;
  isLoggedIn: boolean;
}

interface AuthSessionStorageType extends BaseStorageType<AuthSession> {
  setSession: (token: string, user: AuthUser) => Promise<void>;
  clear: () => Promise<void>;
}

const normalizeAuthToken = (token: string | null | undefined): string | null => {
  const trimmed = token?.trim();
  if (!trimmed) {
    return null;
  }
  const withoutScheme = trimmed.replace(/^Bearer\s+/i, '');
  const firstPart = withoutScheme
    .split(',')
    .map(part => part.trim())
    .find(Boolean);
  if (!firstPart) {
    return null;
  }
  // 只保留签名前的原始 session token（首个 `.` 之前）。
  // Better Auth 的 set-auth-token 形如 `<sessionToken>.<签名>`，其中签名是百分号编码的（`%2F/%3D`）；
  // 而扩展 Service Worker 的 fetch 会对请求头里的 `%xx` 做不稳定解码，服务端再 decodeURIComponent 后
  // 整个 token 被损坏 → 401 invalid_session。原始 session token 是纯字母数字、传输安全，bearer 插件
  // （requireSignature 默认 false）会在服务端自行对它签名校验。这样无论本地存的是 set-auth-token 还是
  // 已剥离的原始 token、也无论是否重新登录，都能稳定通过鉴权。
  return firstPart.split('.')[0] || null;
};

const defaultSession: AuthSession = {
  token: null,
  user: null,
  isLoggedIn: false,
};

const storage = createStorage<AuthSession>('auth-session-storage-key', defaultSession, {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});

const authSessionStorage: AuthSessionStorageType = {
  ...storage,
  setSession: async (token, user) => {
    const normalizedToken = normalizeAuthToken(token);
    if (!normalizedToken) {
      await storage.set(defaultSession);
      return;
    }
    await storage.set({ token: normalizedToken, user, isLoggedIn: true });
  },
  clear: async () => {
    await storage.set(defaultSession);
  },
};

export { authSessionStorage, normalizeAuthToken };
export type { AuthUser, AuthSession, AuthSessionStorageType };
