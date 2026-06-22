import { useEffect, useState } from 'react';
import { getMyHistory } from '@/api/extension-history';
import type { AgentLogSessionInput } from '@/lib/agent-log-schema';

const formatTime = (ms: number) => new Date(ms).toLocaleString('zh-CN');

const getSessionName = (s: AgentLogSessionInput) => s.taskName?.trim() || s.taskId || s.id;

const getStepName = (s: AgentLogSessionInput, entry: AgentLogSessionInput['entries'][number]) =>
  entry.stepName || s.stepNameMapping?.[entry.stepId] || entry.stepId || '未知步骤';

// 与扩展 HistoryModal.buildLogText 对齐的下载文本格式。
function buildLogText(s: AgentLogSessionInput): string {
  const lines: string[] = [
    '对话记录',
    `日志创建时间: ${formatTime(s.createdAt)}`,
    `任务名称: ${getSessionName(s)}`,
    `task_id: ${s.taskId}`,
    '='.repeat(60),
  ];
  for (const entry of s.entries) {
    const roundInfo = entry.round ? ` | 第 ${entry.round} 轮` : '';
    lines.push(`Step: ${getStepName(s, entry)} | step_id: ${entry.stepId}${roundInfo} | 来源: ${entry.source}`);
    if (entry.userText) {
      lines.push(`用户: ${entry.userText}`);
    }
    if (entry.aiText) {
      lines.push(`AI: ${entry.aiText}`);
    }
    lines.push('-'.repeat(40));
  }
  return lines.join('\n');
}

function downloadLogText(s: AgentLogSessionInput) {
  const blob = new Blob([buildLogText(s)], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${getSessionName(s).replace(/[\\/:*?"<>|]/g, '_')}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

export function ExtensionHistoryView() {
  const [loaded, setLoaded] = useState(false);
  const [sessions, setSessions] = useState<AgentLogSessionInput[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    getMyHistory()
      .then(({ sessions: rows }) => {
        const sorted = [...rows].sort((a, b) => b.updatedAt - a.updatedAt);
        setSessions(sorted);
        setActiveId(sorted[0]?.id ?? null);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  if (!loaded) {
    return <p className="text-muted-foreground text-sm">加载中…</p>;
  }
  if (sessions.length === 0) {
    return <p className="text-muted-foreground text-sm">暂无历史记录。</p>;
  }

  const active = sessions.find(s => s.id === activeId) ?? null;

  return (
    <div className="flex max-w-4xl gap-4">
      <ul className="w-64 shrink-0 space-y-1">
        {sessions.map(s => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => setActiveId(s.id)}
              className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                activeId === s.id ? 'border-primary bg-muted' : 'border-border'
              }`}>
              <div className="font-medium">{getSessionName(s)}</div>
              <div className="text-muted-foreground text-xs">{formatTime(s.updatedAt)}</div>
              <div className="text-muted-foreground text-xs">记录数: {s.entries.length}</div>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex-1 rounded-md border p-4">
        {active ? (
          <>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium">{getSessionName(active)}</span>
              <button
                type="button"
                onClick={() => downloadLogText(active)}
                className="rounded-md border px-3 py-1 text-sm">
                下载 TXT
              </button>
            </div>
            <div className="space-y-3 text-sm">
              {active.entries.map((entry, i) => (
                <div key={`${entry.timestamp}_${i}`} className="bg-muted rounded-md p-2">
                  <div className="text-muted-foreground text-xs">
                    {getStepName(active, entry)} · {entry.source}
                  </div>
                  {entry.userText ? <p className="mt-1 whitespace-pre-wrap">用户: {entry.userText}</p> : null}
                  {entry.aiText ? <p className="mt-1 whitespace-pre-wrap">AI: {entry.aiText}</p> : null}
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">请选择左侧一条记录查看。</p>
        )}
      </div>
    </div>
  );
}
