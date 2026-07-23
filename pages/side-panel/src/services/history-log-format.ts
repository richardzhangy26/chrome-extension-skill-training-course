import type { AgentLogEntry, AgentLogSession } from '@extension/storage';

type TimestampFormatter = (timestamp: number) => string;

const getStepDisplayName = (session: AgentLogSession, entry: AgentLogEntry): string =>
  entry.stepName || session.stepNameMapping?.[entry.stepId] || entry.stepId || '未知步骤';

const getSessionDisplayName = (session: AgentLogSession): string =>
  session.taskName?.trim() || session.taskId || session.id;

const getHistoryAiRoleName = (entry: AgentLogEntry): string => entry.aiRoleName?.trim() || 'AI';

const buildAgentLogText = (session: AgentLogSession, formatTimestamp: TimestampFormatter): string => {
  const lines = [
    '对话记录',
    `日志创建时间: ${formatTimestamp(session.createdAt)}`,
    `任务名称: ${getSessionDisplayName(session)}`,
    `task_id: ${session.taskId}`,
    '剧本存放位置: 浏览器本地存储 (chrome.storage.local)',
    '='.repeat(60),
  ];
  for (const entry of session.entries) {
    const roundInfo = entry.round ? ` | 第 ${entry.round} 轮` : '';
    lines.push(
      `Step: ${getStepDisplayName(session, entry)} | step_id: ${entry.stepId}${roundInfo} | 来源: ${entry.source}`,
    );
    if (entry.userText) lines.push(`用户: ${entry.userText}`);
    if (entry.aiText) lines.push(`${getHistoryAiRoleName(entry)}: ${entry.aiText}`);
    lines.push('-'.repeat(40));
  }
  return lines.join('\n');
};

export { buildAgentLogText, getHistoryAiRoleName, getSessionDisplayName, getStepDisplayName };
