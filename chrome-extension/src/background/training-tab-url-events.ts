import { toCurrentTrainingTab } from './current-training-tab';
import type { CurrentTabInfo } from './current-training-tab';

interface TabSnapshot {
  active?: boolean;
  id?: number;
  url?: string;
}

interface TabChangeInfo {
  url?: string;
}

interface TabActivatedInfo {
  tabId: number;
}

interface TrainingTabUrlEventDependencies {
  getTab: (tabId: number) => Promise<TabSnapshot>;
  publish: (tab: CurrentTabInfo) => Promise<void> | void;
}

const createTrainingTabUrlEventController = ({ getTab, publish }: TrainingTabUrlEventDependencies) => {
  const publishTab = async (tab: Pick<TabSnapshot, 'id' | 'url'>) => {
    const currentTab = toCurrentTrainingTab(tab);
    if (currentTab) {
      await publish(currentTab);
    }
  };

  const onUpdated = async (tabId: number, changeInfo: TabChangeInfo, tab: TabSnapshot) => {
    if (!tab.active || !changeInfo.url) {
      return;
    }
    await publishTab({ id: tabId, url: changeInfo.url });
  };

  const onActivated = async ({ tabId }: TabActivatedInfo) => {
    try {
      const tab = await getTab(tabId);
      await publishTab({ id: tabId, url: tab.url });
    } catch {
      // 标签可能在激活事件后立即关闭，忽略即可。
    }
  };

  return { onActivated, onUpdated };
};

export { createTrainingTabUrlEventController };
export type { TabActivatedInfo, TabChangeInfo, TabSnapshot, TrainingTabUrlEventDependencies };
