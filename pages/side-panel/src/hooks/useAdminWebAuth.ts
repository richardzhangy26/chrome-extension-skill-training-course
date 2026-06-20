/**
 * Admin Web 登录态 hook：管理会话、登录/注册/登出，
 * 并在登录后把账号配置下行到本地 llmConfigStorage（首次登录种子）。
 */

import { signIn, signUp, signOut, getSession, fetchLlmConfig, pushLlmConfig } from '../services/admin-web-service';
import { authSessionStorage, llmConfigStorage } from '@extension/storage';
import { useCallback, useEffect, useState } from 'react';
import type { AuthSession } from '@extension/storage';

const useAdminWebAuth = () => {
  const [session, setSession] = useState<AuthSession>({ token: null, user: null, isLoggedIn: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 订阅本地会话存储（登出/失效时 UI 同步）
  useEffect(() => {
    let active = true;
    authSessionStorage.get().then(s => active && setSession(s));
    const unsubscribe = authSessionStorage.subscribe(() => {
      authSessionStorage.get().then(s => active && setSession(s));
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // 登录后把账号配置写入本地；服务端无配置则用本地 seed 上去一次
  const syncConfigDown = useCallback(async () => {
    const remote = await fetchLlmConfig();
    if (remote) {
      await llmConfigStorage.setConfig(remote);
      return;
    }
    const local = await llmConfigStorage.get();
    await pushLlmConfig(local);
  }, []);

  // 启动时校验既有 token 是否仍有效
  useEffect(() => {
    (async () => {
      const current = await authSessionStorage.get();
      if (current.isLoggedIn) {
        const user = await getSession();
        if (user) {
          await syncConfigDown();
        }
        // getSession 内部在 401 时已 clear()，订阅会刷新 UI
      }
      setLoading(false);
    })();
  }, [syncConfigDown]);

  const login = useCallback(
    async (email: string, password: string) => {
      setError(null);
      const result = await signIn({ email, password });
      if (!result.ok) {
        setError(result.error ?? '登录失败');
        return result;
      }
      await syncConfigDown();
      return result;
    },
    [syncConfigDown],
  );

  const register = useCallback(async (email: string, password: string, name: string) => {
    setError(null);
    const result = await signUp({ email, password, name });
    if (!result.ok) {
      setError(result.error ?? '注册失败');
    }
    return result;
  }, []);

  const logout = useCallback(async () => {
    await signOut();
  }, []);

  return {
    session,
    isLoggedIn: session.isLoggedIn,
    loading,
    error,
    login,
    register,
    logout,
    refreshConfig: syncConfigDown,
  };
};

export { useAdminWebAuth };
