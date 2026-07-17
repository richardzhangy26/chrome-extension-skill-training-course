import assert from 'node:assert/strict';
import test from 'node:test';

import { PRO_TRAIN_V2_PORT_NAME } from './protocol.ts';
import { registerContentPortRelay } from './content-port-relay.ts';

const connectCommand = () => ({
  protocol: PRO_TRAIN_V2_PORT_NAME,
  version: 1,
  direction: 'extension-to-page',
  connectionId: 'connection-1',
  type: 'CONNECT',
  payload: { taskId: 'PRO123', userId: 'u1', sessionId: 's1' },
});

const createFakeWindow = () => {
  const listeners = new Set();
  const posted = [];
  return {
    location: { origin: 'https://hike-teaching-center.polymas.com' },
    addEventListener(type, listener) {
      if (type === 'message') listeners.add(listener);
    },
    removeEventListener(type, listener) {
      if (type === 'message') listeners.delete(listener);
    },
    postMessage(data, targetOrigin) {
      posted.push({ data, targetOrigin });
    },
    dispatch(event) {
      for (const listener of listeners) listener(event);
    },
    listenerCount: () => listeners.size,
    posted,
  };
};

const createFakePort = () => {
  const messageListeners = new Set();
  const disconnectListeners = new Set();
  const posted = [];
  return {
    name: PRO_TRAIN_V2_PORT_NAME,
    onMessage: {
      addListener: listener => messageListeners.add(listener),
      removeListener: listener => messageListeners.delete(listener),
    },
    onDisconnect: {
      addListener: listener => disconnectListeners.add(listener),
      removeListener: listener => disconnectListeners.delete(listener),
    },
    postMessage: message => posted.push(message),
    emitMessage: message => {
      for (const listener of messageListeners) listener(message);
    },
    emitDisconnect: () => {
      for (const listener of disconnectListeners) listener();
    },
    posted,
  };
};

const createConnectEvent = () => {
  const listeners = new Set();
  return {
    addListener: listener => listeners.add(listener),
    removeListener: listener => listeners.delete(listener),
    emit: port => {
      for (const listener of listeners) listener(port);
    },
  };
};

test('Port 断开时 relay 给其全部 connectionId 发 CLOSE 并清 listener', () => {
  const fakeWindow = createFakeWindow();
  const onConnect = createConnectEvent();
  const port = createFakePort();
  const stop = registerContentPortRelay(fakeWindow, onConnect);

  onConnect.emit(port);
  port.emitMessage(connectCommand());
  port.emitDisconnect();

  assert.deepEqual(
    fakeWindow.posted.map(({ data }) => data.type),
    ['CONNECT', 'CLOSE'],
  );
  assert.deepEqual(fakeWindow.posted.at(-1), {
    data: {
      protocol: PRO_TRAIN_V2_PORT_NAME,
      version: 1,
      direction: 'extension-to-page',
      connectionId: 'connection-1',
      type: 'CLOSE',
      payload: { code: 1000, reason: 'port disconnected' },
    },
    targetOrigin: fakeWindow.location.origin,
  });
  assert.equal(fakeWindow.listenerCount(), 0);
  stop();
});

test('relay 仅将本 Port 所有的合法页面事件回传', () => {
  const fakeWindow = createFakeWindow();
  const onConnect = createConnectEvent();
  const port = createFakePort();
  registerContentPortRelay(fakeWindow, onConnect);
  onConnect.emit(port);
  port.emitMessage(connectCommand());

  const pageEvent = {
    protocol: PRO_TRAIN_V2_PORT_NAME,
    version: 1,
    direction: 'page-to-extension',
    connectionId: 'connection-1',
    type: 'TEXT',
    payload: { data: 'hello' },
  };
  fakeWindow.dispatch({ source: fakeWindow, origin: fakeWindow.location.origin, data: pageEvent });
  fakeWindow.dispatch({ source: {}, origin: fakeWindow.location.origin, data: pageEvent });
  fakeWindow.dispatch({ source: fakeWindow, origin: 'https://evil.example', data: pageEvent });
  fakeWindow.dispatch({
    source: fakeWindow,
    origin: fakeWindow.location.origin,
    data: { ...pageEvent, connectionId: 'connection-2' },
  });

  assert.deepEqual(port.posted, [pageEvent]);
});
