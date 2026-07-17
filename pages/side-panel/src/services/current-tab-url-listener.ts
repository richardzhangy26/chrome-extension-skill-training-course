interface CurrentTabInfo {
  id: number;
  url: string;
}

interface TabUrlChangedMessage {
  type: string;
  payload?: {
    tabId?: unknown;
    url?: unknown;
  };
}

const createCurrentTabUrlMessageHandler = (
  getCurrentTabInfo: () => Promise<CurrentTabInfo>,
  callback: (url: string) => void,
) => {
  let generation = 0;

  return async (message: TabUrlChangedMessage): Promise<void> => {
    if (
      message.type !== 'TAB_URL_CHANGED' ||
      typeof message.payload?.tabId !== 'number' ||
      typeof message.payload.url !== 'string'
    ) {
      return;
    }

    const requestGeneration = ++generation;
    try {
      const currentTab = await getCurrentTabInfo();
      if (requestGeneration === generation && currentTab.id === message.payload.tabId) {
        callback(currentTab.url);
      }
    } catch {
      // 当前活动标签不是教学页或已关闭时，不切换 Side Panel 的任务状态。
    }
  };
};

export { createCurrentTabUrlMessageHandler };
export type { CurrentTabInfo, TabUrlChangedMessage };
