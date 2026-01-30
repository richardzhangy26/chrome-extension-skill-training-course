/**
 * 历史日志弹窗组件
 */

import { agentLogStorage } from '@extension/storage';
import { useEffect, useMemo, useState } from 'react';
import type { AgentLogSession, AgentLogEntry } from '@extension/storage';

// 历史图标
const HistoryIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <polyline points="3 3 3 9 9 9" />
    <path d="M12 7v5l3 3" />
  </svg>
);

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const formatTimestamp = (timestamp: number) =>
  new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

const getStepDisplayName = (session: AgentLogSession, entry: AgentLogEntry) => {
  if (entry.stepName) {
    return entry.stepName;
  }
  if (session.stepNameMapping?.[entry.stepId]) {
    return session.stepNameMapping[entry.stepId];
  }
  return entry.stepId || '未知步骤';
};

const getSessionDisplayName = (session: AgentLogSession) => session.taskName?.trim() || session.taskId || session.id;

const sanitizeFileName = (value: string) =>
  value
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();

const buildLogText = (session: AgentLogSession) => {
  const sessionName = getSessionDisplayName(session);
  const headerLines = [
    `日志创建时间: ${formatTimestamp(session.createdAt)}`,
    `任务名称: ${sessionName}`,
    `task_id: ${session.taskId}`,
    '剧本存放位置: 浏览器本地存储 (chrome.storage.local)',
    '='.repeat(60),
  ];

  const dialogueLines = [
    '对话记录',
    ...headerLines,
    ...session.entries
      .filter(entry => entry.type === 'chat')
      .flatMap(entry => {
        const stepName = getStepDisplayName(session, entry);
        const roundInfo = entry.round ? ` | 第 ${entry.round} 轮` : '';
        const lines = [`Step: ${stepName} | step_id: ${entry.stepId}${roundInfo} | 来源: ${entry.source}`];
        if (entry.userText) {
          lines.push(`用户: ${entry.userText}`);
        }
        if (entry.aiText) {
          lines.push(`AI: ${entry.aiText}`);
        }
        lines.push('-'.repeat(40));
        return lines;
      }),
  ];

  return dialogueLines.join('\n');
};

const downloadLogText = (session: AgentLogSession) => {
  const content = buildLogText(session);
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const baseName = sanitizeFileName(getSessionDisplayName(session)) || session.id;
  link.href = url;
  link.download = `${baseName}.txt`;
  link.click();
  URL.revokeObjectURL(url);
};

const HistoryModal = ({ isOpen, onClose }: HistoryModalProps) => {
  const [sessions, setSessions] = useState<AgentLogSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [expandedEntryIndex, setExpandedEntryIndex] = useState<number | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isMounted = true;

    const fetchSessions = async () => {
      const data = await agentLogStorage.get();
      if (isMounted) {
        setSessions(data);
      }
    };

    fetchSessions();
    const unsubscribe = agentLogStorage.subscribe(fetchSessions);

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [isOpen]);

  const sortedSessions = useMemo(() => [...sessions].sort((a, b) => b.updatedAt - a.updatedAt), [sessions]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    if (sortedSessions.length === 0) {
      setActiveSessionId(null);
      return;
    }
    setActiveSessionId(prev =>
      prev && sortedSessions.some(session => session.id === prev) ? prev : sortedSessions[0].id,
    );
  }, [isOpen, sortedSessions]);

  useEffect(() => {
    if (!isOpen) {
      setEditingSessionId(null);
      setEditingName('');
      return;
    }
    if (editingSessionId && !sortedSessions.some(session => session.id === editingSessionId)) {
      setEditingSessionId(null);
      setEditingName('');
    }
  }, [editingSessionId, isOpen, sortedSessions]);

  const activeSession = sortedSessions.find(session => session.id === activeSessionId) ?? null;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        onKeyDown={event => event.key === 'Escape' && onClose()}
        role="button"
        tabIndex={0}
        aria-label="关闭弹窗"
      />

      <div className="relative flex max-h-[85vh] w-[92%] max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-teal-500 to-cyan-500 px-5 py-4">
          <div className="flex items-center gap-2 text-white">
            <HistoryIcon />
            <h2 className="text-lg font-semibold">历史记录</h2>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1 text-white/80 transition-colors hover:bg-white/20 hover:text-white">
            <span className="text-xl leading-none">×</span>
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-hidden p-5">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
            剧本存放在浏览器本地存储中，请下载完成后及时清理删除。
          </div>

          <div className="flex flex-1 gap-4 overflow-hidden">
            <div className="w-[40%] min-w-[220px] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
                <span>日志列表</span>
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="cursor-pointer text-red-500 transition-colors hover:text-red-600">
                  清空全部
                </button>
              </div>

              {sortedSessions.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-center text-sm text-slate-400">
                  暂无历史记录
                </div>
              ) : (
                <div className="space-y-2">
                  {sortedSessions.map(session => {
                    const isActive = activeSessionId === session.id;
                    const isEditing = editingSessionId === session.id;
                    const sessionName = getSessionDisplayName(session);

                    return (
                      <div
                        key={session.id}
                        onClick={() => setActiveSessionId(session.id)}
                        onKeyDown={event => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setActiveSessionId(session.id);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                          isActive
                            ? 'border-cyan-300 bg-cyan-50 text-cyan-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-cyan-200'
                        }`}>
                        <div className="flex items-center justify-between">
                          <span className="font-medium">任务: {sessionName}</span>
                          <span>
                            {new Date(session.updatedAt).toLocaleTimeString('zh-CN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-400">{formatTimestamp(session.createdAt)}</div>
                        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                          <span>记录数: {session.entries.filter(entry => entry.type === 'chat').length}</span>
                          {!isEditing && (
                            <button
                              type="button"
                              onClick={event => {
                                event.stopPropagation();
                                setActiveSessionId(session.id);
                                setEditingSessionId(session.id);
                                setEditingName(sessionName);
                              }}
                              className="cursor-pointer text-cyan-600 transition-colors hover:text-cyan-700">
                              编辑名称
                            </button>
                          )}
                        </div>
                        {isEditing && (
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              ref={el => el?.focus()}
                              value={editingName}
                              onChange={event => setEditingName(event.target.value)}
                              onKeyDown={event => {
                                event.stopPropagation();
                                if (event.key === 'Enter') {
                                  event.preventDefault();
                                  void agentLogStorage.updateSessionName(session.id, editingName);
                                  setEditingSessionId(null);
                                  setEditingName('');
                                }
                                if (event.key === 'Escape') {
                                  event.preventDefault();
                                  setEditingSessionId(null);
                                  setEditingName('');
                                }
                              }}
                              onClick={event => event.stopPropagation()}
                              className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 focus:border-cyan-300 focus:outline-none"
                              placeholder="输入任务名称"
                              aria-label="编辑任务名称"
                            />
                            <button
                              type="button"
                              onClick={event => {
                                event.stopPropagation();
                                void agentLogStorage.updateSessionName(session.id, editingName);
                                setEditingSessionId(null);
                                setEditingName('');
                              }}
                              className="cursor-pointer rounded-md border border-cyan-200 bg-cyan-50 px-2 py-1 text-[11px] text-cyan-700 transition-colors hover:border-cyan-300 hover:text-cyan-800">
                              保存
                            </button>
                            <button
                              type="button"
                              onClick={event => {
                                event.stopPropagation();
                                setEditingSessionId(null);
                                setEditingName('');
                              }}
                              className="cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-600">
                              取消
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <span>{activeSession ? getSessionDisplayName(activeSession) : '未选择日志'}</span>
                <div className="flex items-center gap-3 text-xs">
                  <button
                    onClick={() => activeSession && downloadLogText(activeSession)}
                    disabled={!activeSession}
                    className="cursor-pointer rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-600 transition-colors hover:border-cyan-200 hover:text-cyan-600 disabled:cursor-not-allowed disabled:text-slate-300">
                    下载 TXT
                  </button>
                  <button
                    onClick={() => activeSession && agentLogStorage.deleteSession(activeSession.id)}
                    disabled={!activeSession}
                    className="cursor-pointer rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-rose-600 transition-colors hover:border-rose-300 hover:text-rose-700 disabled:cursor-not-allowed disabled:text-rose-300">
                    删除
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 text-xs text-slate-600">
                {!activeSession ? (
                  <div className="flex h-full items-center justify-center text-slate-400">
                    请选择一条日志记录查看详情
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="text-sm font-medium text-slate-700">基本信息</div>
                      <div className="mt-2 space-y-1 text-[11px] text-slate-500">
                        <div>创建时间: {formatTimestamp(activeSession.createdAt)}</div>
                        <div>更新时间: {formatTimestamp(activeSession.updatedAt)}</div>
                        <div>记录数: {activeSession.entries.filter(entry => entry.type === 'chat').length}</div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="text-sm font-medium text-slate-700">最近记录</div>
                      <div className="mt-2 space-y-2 text-[11px] text-slate-500">
                        {activeSession.entries.slice(-6).map((entry, index) => {
                          const isExpanded = expandedEntryIndex === index;
                          return (
                            <div
                              key={`${entry.timestamp}_${index}`}
                              onClick={() => setExpandedEntryIndex(isExpanded ? null : index)}
                              onKeyDown={e => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setExpandedEntryIndex(isExpanded ? null : index);
                                }
                              }}
                              role="button"
                              tabIndex={0}
                              className="cursor-pointer rounded-md bg-slate-50 px-2 py-1.5 transition-colors hover:bg-slate-100">
                              <div className="flex items-center justify-between">
                                <span className="flex items-center gap-1">
                                  {entry.type === 'runCard' ? 'RunCard' : '对话'}
                                  <span className="text-[10px] text-slate-400">{isExpanded ? '▼' : '▶'}</span>
                                </span>
                                <span>
                                  {new Date(entry.timestamp).toLocaleTimeString('zh-CN', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                              <div className="mt-1 text-[10px] text-slate-400">
                                Step: {getStepDisplayName(activeSession, entry)}
                              </div>

                              {isExpanded && entry.type === 'chat' && (
                                <div className="mt-2 space-y-1.5 border-t border-slate-200 pt-2">
                                  {entry.userText && (
                                    <div className="rounded bg-white p-2">
                                      <span className="font-medium text-cyan-600">用户:</span>
                                      <p className="mt-0.5 whitespace-pre-wrap text-slate-600">{entry.userText}</p>
                                    </div>
                                  )}
                                  {entry.aiText && (
                                    <div className="rounded bg-white p-2">
                                      <span className="font-medium text-emerald-600">AI:</span>
                                      <p className="mt-0.5 whitespace-pre-wrap text-slate-600">{entry.aiText}</p>
                                    </div>
                                  )}
                                  {!entry.userText && !entry.aiText && (
                                    <div className="text-slate-400">暂无对话内容</div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 清空确认弹窗 */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowClearConfirm(false)}
            onKeyDown={e => e.key === 'Escape' && setShowClearConfirm(false)}
            role="button"
            tabIndex={0}
            aria-label="取消"
          />
          <div className="relative w-[85%] max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-red-100 to-rose-100">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-8 w-8 text-red-500">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </div>

            <h3 className="mb-2 text-lg font-semibold text-slate-800">确认清空全部？</h3>
            <p className="mb-5 text-sm text-slate-500">此操作将删除所有历史记录，且不可撤销。</p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 cursor-pointer rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100">
                取消
              </button>
              <button
                onClick={() => {
                  agentLogStorage.clearSessions();
                  setShowClearConfirm(false);
                }}
                className="flex-1 cursor-pointer rounded-lg bg-gradient-to-r from-red-500 to-rose-500 py-2.5 text-sm font-medium text-white transition-all hover:from-red-600 hover:to-rose-600">
                确认清空
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export { HistoryIcon, HistoryModal };
