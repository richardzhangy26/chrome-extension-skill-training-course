interface CurrentTabInfo {
  id: number;
  url: string;
}

const toCurrentTrainingTab = (tab: Pick<chrome.tabs.Tab, 'id' | 'url'>): CurrentTabInfo | null => {
  if (typeof tab.id !== 'number' || !tab.url) return null;
  try {
    const url = new URL(tab.url);
    return url.protocol === 'https:' && url.hostname === 'hike-teaching-center.polymas.com'
      ? { id: tab.id, url: url.toString() }
      : null;
  } catch {
    return null;
  }
};

export { toCurrentTrainingTab };
export type { CurrentTabInfo };
