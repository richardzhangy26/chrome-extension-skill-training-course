import assert from 'node:assert/strict';
import test from 'node:test';

const originalChrome = Reflect.get(globalThis, 'chrome');
const messageCalls = [];
const connectCalls = [];
const responses = [];
const port = { name: 'test-port' };

const chromeMock = {
  runtime: {
    lastError: undefined,
    sendMessage(message, callback) {
      messageCalls.push(message);
      callback(responses.shift());
    },
  },
  tabs: {
    connect(tabId, options) {
      connectCalls.push({ tabId, options });
      return port;
    },
  },
};
Reflect.set(globalThis, 'chrome', chromeMock);

const { connectProTrainV2Page, getCurrentTabInfo } = await import('./background-bridge.ts');

test.after(() => {
  Reflect.set(globalThis, 'chrome', originalChrome);
});

test.beforeEach(() => {
  messageCalls.length = 0;
  connectCalls.length = 0;
  responses.length = 0;
});

test('getCurrentTabInfo 公开返回背景验证后的当前 Pro 标签页', async () => {
  const tabInfo = { id: 42, url: 'https://hike-teaching-center.polymas.com/train?trainTaskId=PRO123' };
  responses.push({ success: true, data: tabInfo });

  assert.deepEqual(await getCurrentTabInfo(), tabInfo);
  assert.deepEqual(messageCalls, [{ type: 'GET_CURRENT_TAB_INFO', payload: undefined }]);
});

test('connectProTrainV2Page 复用当前标签页并固定连接顶层 frame 与 port name', async () => {
  responses.push({
    success: true,
    data: { id: 7, url: 'https://hike-teaching-center.polymas.com/train?trainTaskId=PRO123' },
  });

  assert.equal(await connectProTrainV2Page(), port);
  assert.deepEqual(messageCalls, [{ type: 'GET_CURRENT_TAB_INFO', payload: undefined }]);
  assert.deepEqual(connectCalls, [{ tabId: 7, options: { name: 'polymas-pro-train-v2', frameId: 0 } }]);
});

test('getCurrentTabInfo 与 connectProTrainV2Page 保留背景返回的可行动错误', async () => {
  responses.push({ success: false, error: '请打开能力训练 Pro 页面' });
  await assert.rejects(getCurrentTabInfo(), /请打开能力训练 Pro 页面/);

  responses.push({ success: false, error: '请打开能力训练 Pro 页面' });
  await assert.rejects(connectProTrainV2Page(), /请打开能力训练 Pro 页面/);
  assert.deepEqual(connectCalls, []);
});
