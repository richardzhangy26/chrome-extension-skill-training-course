/**
 * Admin Web 登录态 hook：管理会话、登录/注册/登出，
 * 并在登录后把账号配置下行到本地 llmConfigStorage（首次登录种子）。
 */

import { signIn, signUp, signOut, getSession, fetchLlmConfig, pushLlmConfig } from '../services/admin-web-service';
import { authSessionStorage, llmConfigStorage, pickSyncedConfig } from '@extension/storage';
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

  // 配置同步（admin_web 为账号级字段的权威源）：
  // 只同步 SYNCED_LLM_CONFIG_KEYS 覆盖的 7 个字段（API Key / Base URL / Model /
  // 系统提示词 / 学生档位 / 模拟对话内容 / 知识库内容）。
  // 其它本地字段（temperature、TTS、各类开关、当前选中项等）不受服务端影响。
  const syncConfigDown = useCallback(async () => {
    const result = await fetchLlmConfig();
    if (!result.ok) {
      const code = result.code ? ` (${result.code})` : '';
      console.warn(`[admin-web] 拉取配置失败，跳过本次同步：${result.status} ${result.message}${code}`);
      return;
    }
    const local = await llmConfigStorage.get();
    if (result.config) {
      // 服务端 apiKey 为空时不覆盖本地 apiKey，避免历史遗留空配置把本地真实 key 冲掉。
      const server = result.config;
      const serverPatch = server.apiKey.trim().length > 0 ? server : { ...server, apiKey: local.apiKey };
      const merged = { ...local, ...serverPatch };
      // enabled 为本地字段、不在同步集内；下拉后按合并结果的 apiKey 重新派生，
      // 保持「enabled === apiKey 非空」的不变式（换设备登录后同样成立）。
      await llmConfigStorage.setConfig({ ...merged, enabled: merged.apiKey.trim().length > 0 });
      return;
    }
    // 服务端确认无配置（config:null）：本地有有效 key 时上传一次 seed。
    if (local.apiKey.trim().length > 0) {
      const ok = await pushLlmConfig(pickSyncedConfig(local));
      if (!ok) {
        console.warn('[admin-web] 本地配置上传失败');
      }
    }
  }, []);

  // 配置上行（保存即上传）：把本地已保存的同步字段推到服务端。
  // 插件是唯一编辑入口，故保存后主动上传；未登录时视为成功（仅本地保存）。
  // 返回是否上传成功，供保存 UI 做非阻塞提示。
  const syncConfigUp = useCallback(async (): Promise<boolean> => {
    const current = await authSessionStorage.get();
    if (!current.isLoggedIn) {
      return true;
    }
    const local = await llmConfigStorage.get();
    const ok = await pushLlmConfig(pickSyncedConfig(local));
    if (!ok) {
      console.warn('[admin-web] 配置上传失败');
    }
    return ok;
  }, []);

  // 启动时仅校验既有 token 是否仍有效，不再下拉配置：
  // 下拉（server→local 覆盖）只在显式登录时发生，避免用服务端旧值
  // 覆盖插件里已保存但尚未上传的本地配置。
  useEffect(() => {
    (async () => {
      try {
        const current = await authSessionStorage.get();
        if (current.isLoggedIn) {
          await getSession();
          // getSession 内部在 401 时已 clear()，订阅会刷新 UI
        }
      } catch (error) {
        console.warn('[admin-web] 启动校验会话失败', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
    syncConfigUp,
  };
};

export { useAdminWebAuth };
