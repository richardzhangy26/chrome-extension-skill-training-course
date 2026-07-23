import assert from 'node:assert/strict';
import test from 'node:test';

import { createCurrentTabUrlMessageHandler } from './current-tab-url-listener.ts';

const deferred = () => {
  let resolve;
  const promise = new Promise(resolvePromise => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

test('只转发仍为当前活动标签的 URL，并使用重新读取的当前 URL', async () => {
  const received = [];
  let currentTab = { id: 1, url: 'https://hike-teaching-center.polymas.com/task/A' };
  const handle = createCurrentTabUrlMessageHandler(
    async () => currentTab,
    url => received.push(url),
  );

  await handle({
    type: 'TAB_URL_CHANGED',
    payload: { tabId: 2, url: 'https://hike-teaching-center.polymas.com/task/B' },
  });
  currentTab = { id: 2, url: 'https://hike-teaching-center.polymas.com/task/B-current' };
  await handle({
    type: 'TAB_URL_CHANGED',
    payload: { tabId: 2, url: 'https://hike-teaching-center.polymas.com/task/B-stale' },
  });

  assert.deepEqual(received, ['https://hike-teaching-center.polymas.com/task/B-current']);
});

test('畸形消息或当前标签读取失败时忽略', async () => {
  const received = [];
  const handle = createCurrentTabUrlMessageHandler(
    async () => {
      throw new Error('no active training tab');
    },
    url => received.push(url),
  );

  await handle({ type: 'OTHER', payload: { tabId: 1, url: 'x' } });
  await handle({ type: 'TAB_URL_CHANGED', payload: { tabId: '1', url: 'x' } });
  await handle({ type: 'TAB_URL_CHANGED', payload: { tabId: 1, url: 'x' } });

  assert.deepEqual(received, []);
});

test('较早消息的活动标签查询后返回时不会覆盖较新的标签', async () => {
  const firstTab = deferred();
  const received = [];
  let requestCount = 0;
  const handle = createCurrentTabUrlMessageHandler(
    async () => {
      requestCount += 1;
      return requestCount === 1 ? firstTab.promise : { id: 2, url: 'https://hike-teaching-center.polymas.com/task/B' };
    },
    url => received.push(url),
  );

  const handleA = handle({
    type: 'TAB_URL_CHANGED',
    payload: { tabId: 1, url: 'https://hike-teaching-center.polymas.com/task/A' },
  });
  const handleB = handle({
    type: 'TAB_URL_CHANGED',
    payload: { tabId: 2, url: 'https://hike-teaching-center.polymas.com/task/B' },
  });
  await handleB;
  firstTab.resolve({ id: 1, url: 'https://hike-teaching-center.polymas.com/task/A' });
  await handleA;

  assert.deepEqual(received, ['https://hike-teaching-center.polymas.com/task/B']);
});
