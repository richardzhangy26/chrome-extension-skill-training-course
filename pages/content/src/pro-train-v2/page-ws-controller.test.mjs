import assert from 'node:assert/strict';
import test from 'node:test';

import { PRO_TRAIN_V2_PORT_NAME } from './protocol.ts';
import { createPageWsController } from './page-ws-controller.ts';

const connectCommand = (connectionId = 'connection-1') => ({
  protocol: PRO_TRAIN_V2_PORT_NAME,
  version: 1,
  direction: 'extension-to-page',
  connectionId,
  type: 'CONNECT',
  payload: { taskId: 'PRO123', userId: 'user-1', sessionId: 'session-1' },
});

class FakeSocket {
  constructor() {
    this.binaryType = 'blob';
    this.listeners = new Map();
    this.closeCalls = [];
    this.sent = [];
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  close(code, reason) {
    this.closeCalls.push({ code, reason });
  }

  send(data) {
    this.sent.push(data);
  }

  open() {
    this.listeners.get('open')?.({});
  }

  message(data) {
    this.listeners.get('message')?.({ data });
  }

  error() {
    this.listeners.get('error')?.({});
  }

  closeFromServer(code = 1000, reason = '', wasClean = true) {
    this.listeners.get('close')?.({ code, reason, wasClean });
  }
}

test('controller 把 socket 生命周期映射为页面事件且二进制只上报长度', () => {
  const sockets = [];
  const events = [];
  const controller = createPageWsController({
    createSocket: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    emit: event => events.push(event),
    getCurrentPageUrl: () => 'https://hike-teaching-center.polymas.com/training?trainTaskId=PRO123',
  });

  controller.handle(connectCommand());
  sockets[0].open();
  sockets[0].message('hello');
  sockets[0].message(new Uint8Array([1, 2, 3]).buffer);
  sockets[0].error();
  sockets[0].closeFromServer(1000, 'done', true);

  assert.equal(sockets[0].binaryType, 'arraybuffer');
  assert.deepEqual(events, [
    {
      protocol: PRO_TRAIN_V2_PORT_NAME,
      version: 1,
      direction: 'page-to-extension',
      connectionId: 'connection-1',
      type: 'OPEN',
    },
    {
      protocol: PRO_TRAIN_V2_PORT_NAME,
      version: 1,
      direction: 'page-to-extension',
      connectionId: 'connection-1',
      type: 'TEXT',
      payload: { data: 'hello' },
    },
    {
      protocol: PRO_TRAIN_V2_PORT_NAME,
      version: 1,
      direction: 'page-to-extension',
      connectionId: 'connection-1',
      type: 'BINARY',
      payload: { byteLength: 3 },
    },
    {
      protocol: PRO_TRAIN_V2_PORT_NAME,
      version: 1,
      direction: 'page-to-extension',
      connectionId: 'connection-1',
      type: 'ERROR',
    },
    {
      protocol: PRO_TRAIN_V2_PORT_NAME,
      version: 1,
      direction: 'page-to-extension',
      connectionId: 'connection-1',
      type: 'CLOSE',
      payload: { code: 1000, reason: 'done', wasClean: true },
    },
  ]);
});

test('CONNECT 在收到命令时读取页面 URL，拒绝导航后的其它任务', () => {
  const sockets = [];
  let pageUrl = 'https://hike-teaching-center.polymas.com/training?taskId=PRO999';
  const controller = createPageWsController({
    createSocket: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    emit: () => {},
    getCurrentPageUrl: () => pageUrl,
  });

  controller.handle(connectCommand());
  assert.equal(sockets.length, 0);
  pageUrl = 'https://hike-teaching-center.polymas.com/training?taskId=PRO123';
  controller.handle(connectCommand());
  assert.equal(sockets.length, 1);
});

test('CONNECT taskId 不匹配时立即发送终态 ERROR 与 CLOSE 并释放 connectionId', () => {
  const sockets = [];
  const events = [];
  let pageUrl = 'https://hike-teaching-center.polymas.com/training?taskId=PRO999';
  const controller = createPageWsController({
    createSocket: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    emit: event => events.push(event),
    getCurrentPageUrl: () => pageUrl,
  });

  controller.handle(connectCommand());

  assert.deepEqual(
    events.map(event => [event.type, event.payload?.reason]),
    [
      ['ERROR', undefined],
      ['CLOSE', 'task mismatch'],
    ],
  );
  assert.equal(events.at(-1).payload.code, 4000);
  assert.equal(sockets.length, 0);
  pageUrl = 'https://hike-teaching-center.polymas.com/training?taskId=PRO123';
  controller.handle(connectCommand());
  assert.equal(sockets.length, 1);
});

test('createSocket 同步抛错时立即发送终态 ERROR 与 CLOSE 并释放 connectionId', () => {
  const events = [];
  let attempts = 0;
  const controller = createPageWsController({
    createSocket: () => {
      attempts += 1;
      if (attempts === 1) throw new Error('create failed');
      return new FakeSocket();
    },
    emit: event => events.push(event),
    getCurrentPageUrl: () => 'https://hike-teaching-center.polymas.com/training?taskId=PRO123',
  });

  controller.handle(connectCommand());

  assert.deepEqual(
    events.map(event => [event.type, event.payload?.reason]),
    [
      ['ERROR', undefined],
      ['CLOSE', 'socket creation failed'],
    ],
  );
  assert.equal(events.at(-1).payload.code, 4000);
  controller.handle(connectCommand());
  assert.equal(attempts, 2);
});

test('重复 connectionId 先关闭旧 socket，dispose 关闭全部 socket', () => {
  const sockets = [];
  const controller = createPageWsController({
    createSocket: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    emit: () => {},
    getCurrentPageUrl: () => 'https://hike-teaching-center.polymas.com/training?trainTaskId=PRO123',
  });

  controller.handle(connectCommand());
  controller.handle(connectCommand());
  assert.deepEqual(sockets[0].closeCalls, [{ code: 1000, reason: 'replaced' }]);
  controller.dispose();
  assert.deepEqual(sockets[1].closeCalls, [{ code: 1000, reason: 'page bridge disposed' }]);
});

test('重复 connectionId 后忽略旧 socket 的迟到生命周期事件', () => {
  const sockets = [];
  const events = [];
  const controller = createPageWsController({
    createSocket: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    emit: event => events.push(event),
    getCurrentPageUrl: () => 'https://hike-teaching-center.polymas.com/training?trainTaskId=PRO123',
  });

  controller.handle(connectCommand());
  controller.handle(connectCommand());
  sockets[0].open();
  sockets[0].message('late text');
  sockets[0].message(new Uint8Array([1, 2]).buffer);
  sockets[0].error();

  assert.deepEqual(events, []);
  sockets[1].open();
  assert.deepEqual(
    events.map(event => event.type),
    ['OPEN'],
  );
});

test('SEND 仅透传通过协议校验的训练事件，CLOSE 关闭对应 socket', () => {
  const sockets = [];
  const controller = createPageWsController({
    createSocket: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    emit: () => {},
    getCurrentPageUrl: () => 'https://hike-teaching-center.polymas.com/training?trainTaskId=PRO123',
  });
  controller.handle(connectCommand());
  controller.handle({
    protocol: PRO_TRAIN_V2_PORT_NAME,
    version: 1,
    direction: 'extension-to-page',
    connectionId: 'connection-1',
    type: 'SEND',
    payload: { data: '{"event":"userTextInput","payload":{"text":"你好"}}' },
  });
  controller.handle({
    protocol: PRO_TRAIN_V2_PORT_NAME,
    version: 1,
    direction: 'extension-to-page',
    connectionId: 'connection-1',
    type: 'CLOSE',
    payload: { code: 1000, reason: 'done' },
  });

  assert.deepEqual(sockets[0].sent, ['{"event":"userTextInput","payload":{"text":"你好"}}']);
  assert.deepEqual(sockets[0].closeCalls, [{ code: 1000, reason: 'done' }]);
});
