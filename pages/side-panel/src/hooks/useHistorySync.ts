/**
 * 历史同步引擎：登录后把云端与本地历史按 max(updatedAt, deletedAt) 合并，
 * 并订阅本地变更做实时上传/软删传播。仅处理当前用户(ownerUserId===userId)的 session。
 */

import { fetchHistory, pushHistory, deleteHistory } from '../services/admin-web-service';
import { agentLogStorage } from '@extension/storage';
import { useEffect, useRef } from 'react';
import type { AgentLogSession } from '@extension/storage';

const DEBOUNCE_MS = 3000;

const useHistorySync = (isLoggedIn: boolean, userId: string | null): void => {
  const readyRef = useRef(false);
  const snapshotRef = useRef<Map<string, number>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isLoggedIn || !userId) {
      readyRef.current = false;
      snapshotRef.current = new Map();
      return;
    }

    let active = true;
    readyRef.current = false;
    snapshotRef.current = new Map();

    // (1) 登录后一次性合并（tombstone 感知）
    const mergeOnLogin = async () => {
      const result = await fetchHistory();
      if (!active) {
        return;
      }
      if (!result.ok) {
        // 拉取失败：不动本地、不进入对账（避免把本地误当独有上传）。
        return;
      }
      const cloud = new Map(result.sessions.map(s => [s.id, s]));
      const tomb = new Map(result.tombstones.map(t => [t.sessionId, t.deletedAt]));

      const local = await agentLogStorage.get();
      if (!active) {
        return;
      }
      const localOwned = new Map(local.filter(s => s.ownerUserId === userId).map(s => [s.id, s]));

      const mergedOwned = new Map<string, AgentLogSession>();
      const toPush: AgentLogSession[] = [];
      const ids = new Set<string>([...cloud.keys(), ...localOwned.keys()]);
      for (const id of ids) {
        const c = cloud.get(id);
        const l = localOwned.get(id);
        const d = tomb.get(id);
        const cTime = c ? c.updatedAt : -Infinity;
        const lTime = l ? l.updatedAt : -Infinity;
        const dTime = d ?? -Infinity;
        const max = Math.max(cTime, lTime, dTime);
        if (d !== undefined && dTime === max) {
          continue; // tombstone 胜：不纳入本地、不回灌
        }
        if (c && cTime === max) {
          mergedOwned.set(id, { ...c, ownerUserId: userId }); // 云端胜：下载并重盖 owner
        } else if (l) {
          const owned = { ...l, ownerUserId: userId };
          mergedOwned.set(id, owned); // 本地胜/独有：保留并回灌
          toPush.push(owned);
        }
      }

      // 一次批量 set：保留非本用户(其它 owner + 匿名)项原样，替换本用户集。
      const others = local.filter(s => s.ownerUserId !== userId);
      await agentLogStorage.set([...others, ...mergedOwned.values()]);
      if (!active) {
        return;
      }

      // 快照 = 对账后状态；置 ready=true（在此之前订阅回调被忽略，故上面的 set 不会引发回灌）。
      const snap = new Map<string, number>();
      for (const s of mergedOwned.values()) {
        snap.set(s.id, s.updatedAt);
      }
      snapshotRef.current = snap;
      readyRef.current = true;

      if (toPush.length > 0) {
        await pushHistory(toPush);
      }
    };

    // (2) 实时对账（仅 ready 后）
    const reconcileChanges = async () => {
      if (!active || !readyRef.current) {
        return;
      }
      const all = await agentLogStorage.get();
      const owned = all.filter(s => s.ownerUserId === userId);
      const ownedIds = new Set(owned.map(s => s.id));

      const changed: AgentLogSession[] = [];
      for (const s of owned) {
        const prev = snapshotRef.current.get(s.id);
        if (prev === undefined || s.updatedAt > prev) {
          changed.push(s);
        }
      }
      const removed: string[] = [];
      for (const id of snapshotRef.current.keys()) {
        if (!ownedIds.has(id)) {
          removed.push(id);
        }
      }

      if (changed.length > 0 && (await pushHistory(changed))) {
        for (const s of changed) {
          snapshotRef.current.set(s.id, s.updatedAt);
        }
      }
      if (removed.length > 0 && (await deleteHistory(removed))) {
        for (const id of removed) {
          snapshotRef.current.delete(id);
        }
      }
    };

    const handleChange = () => {
      if (!readyRef.current) {
        return; // 合并阶段自身的 set 在此被忽略
      }
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        void reconcileChanges();
      }, DEBOUNCE_MS);
    };

    void mergeOnLogin();
    const unsubscribe = agentLogStorage.subscribe(handleChange);

    return () => {
      active = false;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      unsubscribe();
    };
  }, [isLoggedIn, userId]);
};

export { useHistorySync };
