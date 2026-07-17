import type { AgentLogSessionInput } from '@/lib/agent-log-schema';

type BuildHistoryText = (session: AgentLogSessionInput) => string;
type BuildHistoryFilename = (session: AgentLogSessionInput) => string;

const getRecentPreviewEntries = (session: AgentLogSessionInput, limit: number) => session.entries.slice(-limit);

const getHistoryAiRoleName = (entry: AgentLogSessionInput['entries'][number]): string =>
  entry.aiRoleName?.trim() || 'AI';

const getUniqueHistoryFilename = (filename: string, usedNames: Set<string>) => {
  if (!usedNames.has(filename)) {
    return filename;
  }

  const dotIndex = filename.lastIndexOf('.');
  const base = dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
  const extension = dotIndex > 0 ? filename.slice(dotIndex) : '';
  let index = 2;
  let nextName = `${base}-${index}${extension}`;

  while (usedNames.has(nextName)) {
    index += 1;
    nextName = `${base}-${index}${extension}`;
  }

  return nextName;
};

const buildBulkHistoryZipEntries = (
  sessions: AgentLogSessionInput[],
  buildText: BuildHistoryText,
  buildFilename: BuildHistoryFilename,
) => {
  const usedNames = new Set<string>();
  const entries: Record<string, string> = {};

  for (const session of sessions) {
    const filename = getUniqueHistoryFilename(buildFilename(session), usedNames);
    usedNames.add(filename);
    entries[filename] = buildText(session);
  }

  return entries;
};

export { buildBulkHistoryZipEntries, getHistoryAiRoleName, getRecentPreviewEntries, getUniqueHistoryFilename };
