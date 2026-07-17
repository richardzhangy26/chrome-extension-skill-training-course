/**
 * 获取 Polymas 当前用户 / 学校信息。
 * 对应 auto_audio_train.py 的 get_user_info()。
 */

import { apiRequest } from './background-bridge';

interface PolymasUserInfo {
  userId: string;
  schoolId: string;
}

interface UserDetailResponse {
  code?: number;
  data?: {
    userNid?: string;
    schoolInfo?: {
      nid?: string;
    };
  };
}

const USER_DETAIL_ENDPOINT = 'https://cloudapi.polymas.com/console/v1/get-current-user-detail';

const doFetch = async (): Promise<PolymasUserInfo> => {
  const response = await apiRequest<UserDetailResponse>({
    endpoint: USER_DETAIL_ENDPOINT,
    method: 'POST',
  });
  const userId = response.data?.userNid?.trim();
  const schoolId = response.data?.schoolInfo?.nid?.trim();
  if (!userId || !schoolId) {
    throw new Error('未获取到 Polymas 用户/学校信息（请确认已登录）');
  }
  return { userId, schoolId };
};

const createPolymasUserInfoLoader = (fetcher: () => Promise<PolymasUserInfo>) => {
  let cachedPromise: Promise<PolymasUserInfo> | null = null;

  const startFetch = () => {
    const request = fetcher();
    cachedPromise = request;
    void request.catch(() => {
      if (cachedPromise === request) {
        cachedPromise = null;
      }
    });
    return request;
  };

  return {
    fetch: () => cachedPromise ?? startFetch(),
    refresh: () => {
      cachedPromise = null;
      return startFetch();
    },
    invalidate: () => {
      cachedPromise = null;
    },
  };
};

const userInfoLoader = createPolymasUserInfoLoader(doFetch);

const fetchPolymasUserInfo = () => userInfoLoader.fetch();

const refreshPolymasUserInfo = () => userInfoLoader.refresh();

const invalidatePolymasUserInfo = () => userInfoLoader.invalidate();

export { createPolymasUserInfoLoader, fetchPolymasUserInfo, refreshPolymasUserInfo, invalidatePolymasUserInfo };
export type { PolymasUserInfo };
