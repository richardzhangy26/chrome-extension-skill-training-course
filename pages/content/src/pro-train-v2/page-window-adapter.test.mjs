import assert from 'node:assert/strict';
import test from 'node:test';

import { PRO_TRAIN_V2_PORT_NAME } from './protocol.ts';
import { startPageWindowAdapter } from './page-window-adapter.ts';

const createCommand = () => ({
  protocol: PRO_TRAIN_V2_PORT_NAME,
  version: 1,
  direction: 'extension-to-page',
  connectionId: 'connection-1',
  type: 'CONNECT',
  payload: { taskId: 'PRO123', userId: 'u1', sessionId: 's1' },
});

const createFakeWindow = () => {
  const listeners = new Set();
  return {
    location: { origin: 'https://hike-teaching-center.polymas.com' },
    addEventListener(type, listener) {
      if (type === 'message') listeners.add(listener);
    },
    removeEventListener(type, listener) {
      if (type === 'message') listeners.delete(listener);
    },
    dispatch(event) {
      for (const listener of listeners) listener(event);
    },
    listenerCount: () => listeners.size,
  };
};

test('window adapter 只接受同 window、同 origin 的合法命令', () => {
  const fakeWindow = createFakeWindow();
  const handled = [];
  const stop = startPageWindowAdapter(fakeWindow, { handle: command => handled.push(command), dispose: () => {} });

  fakeWindow.dispatch({ source: {}, origin: fakeWindow.location.origin, data: createCommand() });
  fakeWindow.dispatch({ source: fakeWindow, origin: 'https://evil.example', data: createCommand() });
  fakeWindow.dispatch({ source: fakeWindow, origin: fakeWindow.location.origin, data: createCommand() });
  fakeWindow.dispatch({ source: fakeWindow, origin: fakeWindow.location.origin, data: { type: 'CONNECT' } });

  assert.equal(handled.length, 1);
  stop();
  assert.equal(fakeWindow.listenerCount(), 0);
});
