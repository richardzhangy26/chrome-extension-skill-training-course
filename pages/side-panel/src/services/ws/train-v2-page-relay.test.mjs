import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout } from 'node:timers';

import { createTrainV2PageRelaySocket, TRAIN_V2_SOCKET_STATE } from './train-v2-page-relay.ts';

const flush = async () => new Promise(resolve => setTimeout(resolve, 0));

const createEmitter = () => {
  const listeners = new Set();
  return {
    addListener: listener => listeners.add(listener),
    removeListener: listener => listeners.delete(listener),
    emit: value => {
      for (const listener of [...listeners]) listener(value);
    },
    get size() {
      return listeners.size;
    },
  };
};

const createPort = () => {
  const onMessage = createEmitter();
  const onDisconnect = createEmitter();
  return {
    onMessage,
    onDisconnect,
    messages: [],
    disconnected: false,
    postMessage(message) {
      this.messages.push(message);
    },
    disconnect() {
      this.disconnected = true;
      onDisconnect.emit();
    },
    emitMessage(message) {
      onMessage.emit(message);
    },
    emitDisconnect() {
      onDisconnect.emit();
    },
  };
};

const pageEvent = (type, connectionId = 'cid', payload) => ({
  protocol: 'polymas-pro-train-v2',
  version: 1,
  direction: 'page-to-extension',
  connectionId,
  type,
  ...(payload === undefined ? {} : { payload }),
});

const params = { taskId: 'PRO123', userId: 'user-1', sessionId: 'session-1' };

const createFakeScheduler = () => {
  let pending = null;
  let delayMs = null;
  let clearCalls = 0;
  return {
    dependencies: {
      scheduleErrorFallback(callback, delay) {
        pending = callback;
        delayMs = delay;
        return callback;
      },
      clearErrorFallback(handle) {
        clearCalls += 1;
        if (pending === handle) pending = null;
      },
    },
    run() {
      const callback = pending;
      pending = null;
      callback?.();
    },
    get pending() {
      return pending !== null;
    },
    get delayMs() {
      return delayMs;
    },
    get clearCalls() {
      return clearCalls;
    },
  };
};

test('relay OPEN 后 readyState=OPEN，SEND/CLOSE 通过同一 connectionId', async () => {
  const port = createPort();
  const socket = createTrainV2PageRelaySocket(params, { connectPort: async () => port, connectionId: () => 'cid' });
  await flush();
  port.emitMessage(pageEvent('OPEN'));
  socket.send('{"event":"scriptStart"}');
  socket.close(1000, 'done');

  assert.equal(socket.readyState, TRAIN_V2_SOCKET_STATE.CLOSED);
  assert.deepEqual(port.messages[0], {
    protocol: 'polymas-pro-train-v2',
    version: 1,
    direction: 'extension-to-page',
    connectionId: 'cid',
    type: 'CONNECT',
    payload: params,
  });
  assert.deepEqual(
    port.messages.map(message => message.type),
    ['CONNECT', 'SEND', 'CLOSE'],
  );
  assert.deepEqual(
    port.messages.map(message => message.connectionId),
    ['cid', 'cid', 'cid'],
  );
  assert.equal(port.disconnected, true);
});

test('relay 只消费首个匹配 OPEN，BINARY 保留为非字符串 activity 帧并过滤畸形事件', async () => {
  const port = createPort();
  const socket = createTrainV2PageRelaySocket(params, { connectPort: async () => port, connectionId: () => 'cid' });
  const opens = [];
  const messages = [];
  socket.addEventListener('open', () => opens.push('open'));
  socket.addEventListener('message', event => messages.push(event));
  await flush();

  port.emitMessage(pageEvent('OPEN', 'wrong'));
  port.emitMessage({ type: 'OPEN' });
  assert.equal(socket.readyState, TRAIN_V2_SOCKET_STATE.CONNECTING);
  port.emitMessage(pageEvent('OPEN'));
  port.emitMessage(pageEvent('OPEN'));
  port.emitMessage(pageEvent('BINARY', 'cid', { byteLength: 0 }));

  assert.equal(socket.readyState, TRAIN_V2_SOCKET_STATE.OPEN);
  assert.deepEqual(opens, ['open']);
  assert.equal(messages.length, 1);
  assert.equal(typeof messages[0].data, 'object');
  assert.equal(messages[0].data.byteLength, 0);
});

test('close 发生在 connectPort 兑现前时，迟到 Port 立即断开且不发送 CONNECT 或挂监听', async () => {
  let resolvePort;
  const pendingPort = new Promise(resolve => {
    resolvePort = resolve;
  });
  const socket = createTrainV2PageRelaySocket(params, { connectPort: () => pendingPort, connectionId: () => 'cid' });
  socket.close();
  const port = createPort();
  resolvePort(port);
  await flush();

  assert.equal(socket.readyState, TRAIN_V2_SOCKET_STATE.CLOSED);
  assert.equal(port.disconnected, true);
  assert.deepEqual(port.messages, []);
  assert.equal(port.onMessage.size, 0);
  assert.equal(port.onDisconnect.size, 0);
});

test('Port 在 OPEN 前断开时只报告一次可行动错误与 1006 close，并保持终态', async () => {
  const port = createPort();
  let lastErrorReads = 0;
  const socket = createTrainV2PageRelaySocket(params, {
    connectPort: async () => port,
    connectionId: () => 'cid',
    readLastError: () => {
      lastErrorReads += 1;
      return 'Could not establish connection. Receiving end does not exist.';
    },
  });
  const errors = [];
  const closes = [];
  socket.addEventListener('error', event => errors.push(event));
  socket.addEventListener('close', event => closes.push(event));
  await flush();
  port.emitDisconnect();
  port.emitDisconnect();
  port.emitMessage(pageEvent('OPEN'));

  assert.equal(lastErrorReads, 1);
  assert.equal(errors.length, 1);
  assert.deepEqual(closes, [{ code: 1006, reason: '请刷新能力训练 Pro 页面后重试', wasClean: false }]);
  assert.equal(socket.readyState, TRAIN_V2_SOCKET_STATE.CLOSED);
  assert.equal(port.onMessage.size, 0);
  assert.equal(port.onDisconnect.size, 0);
});

test('Port 在 OPEN 后断开时单次 error + 1006 close，清 listener 并忽略迟到事件', async () => {
  const port = createPort();
  const socket = createTrainV2PageRelaySocket(params, { connectPort: async () => port, connectionId: () => 'cid' });
  const errors = [];
  const closes = [];
  socket.addEventListener('error', event => errors.push(event));
  socket.addEventListener('close', event => closes.push(event));
  await flush();
  port.emitMessage(pageEvent('OPEN'));
  port.emitDisconnect();
  port.emitDisconnect();
  port.emitMessage(pageEvent('TEXT', 'cid', { data: 'late' }));

  assert.equal(errors.length, 1);
  assert.deepEqual(closes, [{ code: 1006, reason: '能力训练 Pro 页面连接已断开，请刷新页面后重试', wasClean: false }]);
  assert.equal(socket.readyState, TRAIN_V2_SOCKET_STATE.CLOSED);
  assert.equal(port.onMessage.size, 0);
  assert.equal(port.onDisconnect.size, 0);
});

test('connectPort rejection 保留非空原始可行动原因', async () => {
  const socket = createTrainV2PageRelaySocket(params, {
    connectPort: async () => {
      throw new Error('请打开能力训练 Pro 页面');
    },
    connectionId: () => 'cid',
  });
  const errors = [];
  const closes = [];
  socket.addEventListener('error', event => errors.push(event));
  socket.addEventListener('close', event => closes.push(event));
  await flush();

  assert.equal(errors.length, 1);
  assert.deepEqual(closes, [{ code: 1006, reason: '请打开能力训练 Pro 页面', wasClean: false }]);
});

test('ERROR 后的具体 CLOSE 保留 code/reason，只产生一次 error/close 并取消 fallback', async () => {
  const port = createPort();
  const scheduler = createFakeScheduler();
  const socket = createTrainV2PageRelaySocket(params, {
    connectPort: async () => port,
    connectionId: () => 'cid',
    ...scheduler.dependencies,
  });
  const opens = [];
  const messages = [];
  const errors = [];
  const closes = [];
  socket.addEventListener('open', event => opens.push(event));
  socket.addEventListener('message', event => messages.push(event));
  socket.addEventListener('error', event => errors.push(event));
  socket.addEventListener('close', event => closes.push(event));
  await flush();
  port.emitMessage(pageEvent('ERROR'));
  port.emitMessage(pageEvent('OPEN'));
  port.emitMessage(pageEvent('TEXT', 'cid', { data: 'late' }));
  socket.send('{"event":"scriptStart"}');

  assert.equal(scheduler.pending, true);
  assert.equal(scheduler.delayMs, 100);
  assert.deepEqual(opens, []);
  assert.deepEqual(messages, []);
  assert.deepEqual(
    port.messages.map(message => message.type),
    ['CONNECT'],
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(closes, []);

  port.emitMessage(pageEvent('CLOSE', 'cid', { code: 4000, reason: 'task mismatch', wasClean: false }));
  port.emitMessage(pageEvent('OPEN'));
  scheduler.run();

  assert.equal(errors.length, 1);
  assert.deepEqual(closes, [{ code: 4000, reason: 'task mismatch', wasClean: false }]);
  assert.equal(scheduler.pending, false);
  assert.equal(scheduler.clearCalls, 1);
  assert.equal(port.disconnected, true);
  assert.equal(socket.readyState, TRAIN_V2_SOCKET_STATE.CLOSED);
});

test('ERROR 未收到 CLOSE 时由 fake scheduler 触发 1006 fallback', async () => {
  const port = createPort();
  const scheduler = createFakeScheduler();
  const socket = createTrainV2PageRelaySocket(params, {
    connectPort: async () => port,
    connectionId: () => 'cid',
    ...scheduler.dependencies,
  });
  const errors = [];
  const closes = [];
  socket.addEventListener('error', event => errors.push(event));
  socket.addEventListener('close', event => closes.push(event));
  await flush();
  port.emitMessage(pageEvent('ERROR'));

  assert.equal(scheduler.pending, true);
  assert.deepEqual(errors, []);
  assert.deepEqual(closes, []);
  scheduler.run();

  assert.equal(errors.length, 1);
  assert.deepEqual(closes, [{ code: 1006, reason: '能力训练 Pro 页面连接失败，请刷新页面后重试', wasClean: false }]);
  assert.equal(socket.readyState, TRAIN_V2_SOCKET_STATE.CLOSED);
  assert.equal(port.onMessage.size, 0);
  assert.equal(port.onDisconnect.size, 0);
});

test('主动 close 幂等且不发 error，只发送一次 CLOSE', async () => {
  const port = createPort();
  const socket = createTrainV2PageRelaySocket(params, { connectPort: async () => port, connectionId: () => 'cid' });
  const errors = [];
  const closes = [];
  socket.addEventListener('error', event => errors.push(event));
  socket.addEventListener('close', event => closes.push(event));
  await flush();
  socket.close(1000, 'done');
  socket.close(1000, 'done again');

  assert.deepEqual(errors, []);
  assert.deepEqual(closes, [{ code: 1000, reason: 'done', wasClean: true }]);
  assert.deepEqual(
    port.messages.map(message => message.type),
    ['CONNECT', 'CLOSE'],
  );
  assert.equal(port.onMessage.size, 0);
  assert.equal(port.onDisconnect.size, 0);
});

test('页面 CLOSE 单次终态且不发 error', async () => {
  const port = createPort();
  const socket = createTrainV2PageRelaySocket(params, { connectPort: async () => port, connectionId: () => 'cid' });
  const errors = [];
  const closes = [];
  socket.addEventListener('error', event => errors.push(event));
  socket.addEventListener('close', event => closes.push(event));
  await flush();
  port.emitMessage(pageEvent('CLOSE', 'cid', { code: 4001, reason: 'server closed', wasClean: false }));
  port.emitMessage(pageEvent('CLOSE', 'cid', { code: 4002, reason: 'late', wasClean: false }));
  socket.close();

  assert.deepEqual(errors, []);
  assert.deepEqual(closes, [{ code: 4001, reason: 'server closed', wasClean: false }]);
  assert.equal(socket.readyState, TRAIN_V2_SOCKET_STATE.CLOSED);
  assert.equal(port.disconnected, true);
  assert.equal(port.onMessage.size, 0);
  assert.equal(port.onDisconnect.size, 0);
});
