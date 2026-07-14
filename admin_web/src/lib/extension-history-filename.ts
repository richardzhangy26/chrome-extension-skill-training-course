import type { AgentLogSessionInput } from '@/lib/agent-log-schema';

const INVALID_FILENAME_CHARS = /[\\/:*?"<>|]/g;

const getSessionName = (session: AgentLogSessionInput) => session.taskName?.trim() || session.taskId || session.id;

const normalizeText = (value: string | undefined): string | undefined => {
  const normalized = value?.trim().replace(/\s+/g, ' ');
  return normalized && normalized.length > 0 ? normalized : undefined;
};

const sanitizeFileNameSegment = (value: string) =>
  value.replace(INVALID_FILENAME_CHARS, '_').replace(/^\.+$/, '_').trim();

const stripSchoolNameFromCourseName = (courseName: string | undefined, schoolName: string | undefined) => {
  const normalizedCourseName = normalizeText(courseName);
  const normalizedSchoolName = normalizeText(schoolName);
  if (!normalizedCourseName) {
    return undefined;
  }
  if (normalizedSchoolName && normalizedCourseName.endsWith(normalizedSchoolName)) {
    return normalizeText(normalizedCourseName.slice(0, -normalizedSchoolName.length));
  }
  return normalizedCourseName;
};

const extractTaskNameAndProfileLabel = (session: AgentLogSessionInput) => {
  const sessionName = normalizeText(session.taskName);
  if (!sessionName) {
    return { taskName: undefined, profileLabel: undefined };
  }

  const withoutKnownSuffix = sessionName.replace(/-(剧本|口语)$/, '');
  const parts = withoutKnownSuffix
    .split('-')
    .map(part => part.trim())
    .filter(Boolean);
  if (parts.length < 2) {
    return { taskName: sessionName, profileLabel: undefined };
  }

  const lastPart = parts.at(-1);
  if (lastPart && /^[a-z0-9]{4}$/i.test(lastPart) && parts.length >= 3) {
    return {
      taskName: normalizeText(parts.slice(0, -2).join('-')),
      profileLabel: parts.at(-2),
    };
  }
  return {
    taskName: normalizeText(parts.slice(0, -1).join('-')),
    profileLabel: lastPart,
  };
};

const getTrainingMetaDisplayParts = (session: AgentLogSessionInput) => {
  const schoolName = normalizeText(session.trainingMeta?.schoolName);
  const courseName = stripSchoolNameFromCourseName(session.trainingMeta?.courseName, schoolName);
  const regionName = normalizeText(session.trainingMeta?.regionName);
  return { schoolName, courseName, regionName };
};

const buildTrainingMetaSummary = (session: AgentLogSessionInput) => {
  const { schoolName, courseName, regionName } = getTrainingMetaDisplayParts(session);
  return [schoolName, courseName, regionName].filter(Boolean).join(' · ');
};

const buildHistoryDownloadFilename = (session: AgentLogSessionInput) => {
  const { schoolName, courseName } = getTrainingMetaDisplayParts(session);
  const { taskName, profileLabel } = extractTaskNameAndProfileLabel(session);
  const segments =
    schoolName && courseName
      ? [schoolName, courseName, taskName, profileLabel].filter((part): part is string => Boolean(part))
      : [getSessionName(session)];
  const filename = segments.map(sanitizeFileNameSegment).join('-');
  return `${filename || session.id}.txt`;
};

export { buildHistoryDownloadFilename, buildTrainingMetaSummary, getSessionName };
