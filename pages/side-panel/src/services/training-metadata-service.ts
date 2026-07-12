import { apiRequest, getCurrentTabUrl } from './background-bridge';
import type { AgentTrainingMeta } from '@extension/storage';

interface ApiResponse<T> {
  code?: number;
  message?: string;
  data?: T;
}

interface OptimizeAllCourseItem {
  course?: {
    courseId?: string | number;
    courseName?: string;
  };
  teachers?: Array<{
    teacherName?: string;
  }>;
}

interface AgentBotCourse {
  agentName?: string;
}

const OPTIMIZE_ALL_COURSE_ENDPOINT =
  'https://cloudapi.polymas.com/teacher-course/course/teacher/list/optimizeAllCourse';
const AGENT_BOT_COURSE_ENDPOINT = 'https://cloudapi.polymas.com/basic-course/agentBotCourse/getByCourseIdNew';

const metadataCache = new Map<string, Promise<AgentTrainingMeta | undefined>>();

const normalizeText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized.length > 0 ? normalized : undefined;
};

const extractCourseIdFromUrl = (url: string | null | undefined): string | null => {
  if (!url) {
    return null;
  }

  try {
    const urlObj = new URL(url);
    const businessId = normalizeText(urlObj.searchParams.get('businessId'));
    if (businessId) {
      return businessId;
    }

    const courseId = normalizeText(urlObj.searchParams.get('courseId'));
    if (courseId) {
      return courseId;
    }

    const pathCourseId = urlObj.pathname.match(/\/agent-course-full\/([^/?#]+)/)?.[1];
    return normalizeText(pathCourseId) ?? null;
  } catch {
    const pathCourseId = url.match(/\/agent-course-full\/([^/?#]+)/)?.[1];
    return normalizeText(pathCourseId) ?? null;
  }
};

const inferSchoolNameFromCourseName = (courseName: string | null | undefined): string | undefined => {
  const normalized = normalizeText(courseName);
  if (!normalized) {
    return undefined;
  }

  const lastToken = normalized.split(' ').at(-1);
  if (lastToken && /(大学|学院|学校|医院|中学|中心)$/.test(lastToken)) {
    return lastToken;
  }

  return normalized.match(/([\u4e00-\u9fa5]{2,}(?:大学|学院|学校|医院|中学|中心))$/)?.[1];
};

const getDisplayCourseName = (courseName: string | undefined, schoolName: string | undefined): string | undefined => {
  if (!courseName) {
    return undefined;
  }
  if (schoolName && courseName.endsWith(schoolName)) {
    return normalizeText(courseName.slice(0, -schoolName.length));
  }
  return courseName;
};

const buildMetaFromCourseItem = (courseId: string, item: OptimizeAllCourseItem): AgentTrainingMeta | undefined => {
  const matchedCourseId = item.course?.courseId == null ? undefined : String(item.course.courseId);
  if (matchedCourseId !== courseId) {
    return undefined;
  }

  const courseName = normalizeText(item.course?.courseName);
  const schoolName = inferSchoolNameFromCourseName(courseName);
  const regionName = normalizeText(item.teachers?.[0]?.teacherName);

  return {
    courseId,
    ...(courseName ? { courseName } : {}),
    ...(schoolName ? { schoolName } : {}),
    ...(regionName ? { regionName } : {}),
  };
};

const fetchMetaFromCourseList = async (courseId: string): Promise<AgentTrainingMeta | undefined> => {
  const response = await apiRequest<ApiResponse<OptimizeAllCourseItem[]>>({
    endpoint: OPTIMIZE_ALL_COURSE_ENDPOINT,
    method: 'GET',
  });
  const courses = Array.isArray(response.data) ? response.data : [];
  return courses.map(item => buildMetaFromCourseItem(courseId, item)).find(Boolean);
};

const extractAgentBotCourse = (data: unknown): AgentBotCourse | undefined => {
  if (Array.isArray(data)) {
    return data.find(item => typeof item === 'object' && item !== null) as AgentBotCourse | undefined;
  }
  if (typeof data === 'object' && data !== null) {
    return data as AgentBotCourse;
  }
  return undefined;
};

const fetchMetaFromAgentBot = async (courseId: string): Promise<AgentTrainingMeta | undefined> => {
  const response = await apiRequest<ApiResponse<unknown>>({
    endpoint: `${AGENT_BOT_COURSE_ENDPOINT}?courseId=${encodeURIComponent(courseId)}`,
    method: 'GET',
  });
  const agentName = normalizeText(extractAgentBotCourse(response.data)?.agentName);
  if (!agentName) {
    return { courseId };
  }

  const schoolName = inferSchoolNameFromCourseName(agentName);
  const courseName = getDisplayCourseName(agentName, schoolName);
  return {
    courseId,
    agentName,
    ...(courseName ? { courseName } : {}),
    ...(schoolName ? { schoolName } : {}),
  };
};

const fetchTrainingMetadataByCourseId = async (courseId: string): Promise<AgentTrainingMeta | undefined> => {
  try {
    const fromCourseList = await fetchMetaFromCourseList(courseId);
    if (fromCourseList) {
      return fromCourseList;
    }
  } catch (error) {
    console.warn('[training-meta] 课程列表匹配失败，尝试智能体兜底', error);
  }

  try {
    return await fetchMetaFromAgentBot(courseId);
  } catch (error) {
    console.warn('[training-meta] 智能体课程元数据获取失败', error);
    return { courseId };
  }
};

const resolveTrainingMetadata = async (): Promise<AgentTrainingMeta | undefined> => {
  const currentUrl = await getCurrentTabUrl();
  const courseId = extractCourseIdFromUrl(currentUrl);
  if (!courseId) {
    return undefined;
  }

  const cached = metadataCache.get(courseId);
  if (cached) {
    return cached;
  }

  const promise = fetchTrainingMetadataByCourseId(courseId);
  metadataCache.set(courseId, promise);
  const meta = await promise;
  if (!meta?.courseName && !meta?.schoolName && !meta?.regionName && !meta?.agentName) {
    metadataCache.delete(courseId);
  }
  return meta;
};

export { extractCourseIdFromUrl, inferSchoolNameFromCourseName, resolveTrainingMetadata };
