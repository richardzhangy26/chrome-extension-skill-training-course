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

  // 配置同步（admin_web 为准）：服务端有「有效」配置则下行覆盖本地；
  // 服务端无有效配置但本地有效则上传一次 seed；两边都无效则不动，
  // 从源头杜绝「空配置上传 → 反过来覆盖本地真实 key」。
  const syncConfigDown = useCallback(async () => {
    const result = await fetchLlmConfig();
    if (!result.ok) {
      // 请求失败（网络/401 等）：不种子、不覆盖本地配置
      const code = result.code ? ` (${result.code})` : '';
      console.warn(`[admin-web] 拉取配置失败，跳过本次同步：${result.status} ${result.message}${code}`);
      return;
    }
    const local = await llmConfigStorage.get();
    if (result.config) {
      // 服务端有 key → 完全以服务端为准（含 simulation/知识库/TTS/档位等）；
      // 服务端无 key 但本地有 → 仅保留本地 key、其余仍取服务端，
      // 避免历史遗留的空 key 配置把本地真实 key 覆盖掉，也不丢网页侧的其它配置。
      const server = result.config;
      const merged =
        server.apiKey.trim().length > 0
          ? server
          : { ...server, apiKey: local.apiKey, enabled: local.apiKey.trim().length > 0 };
      await llmConfigStorage.setConfig(merged);
      return;
    }
    // 服务端确认无配置（config:null）：仅当本地有有效 key 时才上传一次 seed（默认/空配置绝不上传）
    if (local.apiKey.trim().length > 0) {
      const ok = await pushLlmConfig(local);
      if (!ok) {
        console.warn('[admin-web] 本地配置上传失败');
      }
    }
  }, []);

  // 启动时校验既有 token 是否仍有效
  useEffect(() => {
    (async () => {
      try {
        const current = await authSessionStorage.get();
        if (current.isLoggedIn) {
          const user = await getSession();
          if (user) {
            await syncConfigDown();
          }
          // getSession 内部在 401 时已 clear()，订阅会刷新 UI
        }
      } catch (error) {
        console.warn('[admin-web] 启动同步失败', error);
      } finally {
        setLoading(false);
      }
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
