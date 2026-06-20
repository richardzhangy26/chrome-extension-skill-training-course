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
    await storage.set({ token, user, isLoggedIn: true });
  },
  clear: async () => {
    await storage.set(defaultSession);
  },
};

export { authSessionStorage };
export type { AuthUser, AuthSession, AuthSessionStorageType };
