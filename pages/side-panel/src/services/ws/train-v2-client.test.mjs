import assert from 'node:assert/strict';
import console from 'node:console';
import test from 'node:test';
import {
  buildTrainV2CloseDiagnostic,
  dispatchTrainV2Message,
  HEARTBEAT_INTERVAL_MS,
  TRAIN_V2_WS_BASE,
  TrainV2Client,
} from './train-v2-client.ts';

const createFakeSocket = () => {
  const listeners = new Map();
  const socket = {
    binaryType: 'blob',
    readyState: 0,
    sent: [],
    closeCalls: [],
    addEventListener(type, listener) {
      const entries = listeners.get(type) ?? [];
      entries.push(listener);
      listeners.set(type, entries);
    },
    send(data) {
      this.sent.push(data);
    },
    close(code = 1000, reason = '') {
      if (this.readyState === 3) return;
      this.closeCalls.push({ code, reason });
      this.readyState = 3;
      this.emit('close', { code, reason, wasClean: true });
    },
    emit(type, event = {}) {
      for (const listener of listeners.get(type) ?? []) listener(event);
    },
    emitOpen() {
      this.readyState = 1;
      this.emit('open');
    },
    emitError() {
      this.emit('error');
    },
    emitClose(event) {
      this.readyState = 3;
      this.emit('close', event);
    },
  };
  return socket;
};

const withFakeTimers = async callback => {
  const originals = {
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    setInterval: globalThis.setInterval,
    clearInterval: globalThis.clearInterval,
  };
  let nextHandle = 1;
  const timeoutCallbacks = new Map();
  const intervalCallbacks = new Map();
  const clearedTimeouts = [];
  const clearedIntervals = [];
  globalThis.setTimeout = callbackValue => {
    const handle = nextHandle++;
    timeoutCallbacks.set(handle, callbackValue);
    return handle;
  };
  globalThis.clearTimeout = handle => {
    clearedTimeouts.push(handle);
    timeoutCallbacks.delete(handle);
  };
  globalThis.setInterval = callbackValue => {
    const handle = nextHandle++;
    intervalCallbacks.set(handle, callbackValue);
    return handle;
  };
  globalThis.clearInterval = handle => {
    clearedIntervals.push(handle);
    intervalCallbacks.delete(handle);
  };
  const timers = {
    timeoutCallbacks,
    intervalCallbacks,
    clearedTimeouts,
    clearedIntervals,
  };
  try {
    await callback(timers);
  } finally {
    globalThis.setTimeout = originals.setTimeout;
    globalThis.clearTimeout = originals.clearTimeout;
    globalThis.setInterval = originals.setInterval;
    globalThis.clearInterval = originals.clearInterval;
  }
};

const clientParams = { taskId: 'PRO123', userId: 'user-1', sessionId: 'session-1' };

test('clean 1000 close 使用 debug，异常 close 使用 warn', () => {
  assert.deepEqual(buildTrainV2CloseDiagnostic({ code: 1000, reason: 'client close', wasClean: true }, 'connected'), {
    level: 'debug',
    message: '[pro-ws] close code=1000 reason=client close wasClean=true phase=connected',
  });
  assert.equal(buildTrainV2CloseDiagnostic({ code: 1006, reason: '', wasClean: false }, 'handshake').level, 'warn');
});

test('error 事件只向 console.warn 传诊断字符串，不附加不透明对象', async () => {
  const socket = createFakeSocket();
  const calls = [];
  const originalWarn = console.warn;
  console.warn = (...args) => calls.push(args);
  try {
    const client = new TrainV2Client(clientParams, {}, () => socket);
    const connecting = client.connect();
    socket.emitError();
    await assert.rejects(connecting, /WebSocket 连接失败/);
    assert.equal(calls.at(-1).length, 1);
    assert.match(calls.at(-1)[0], /phase=handshake/);
  } finally {
    console.warn = originalWarn;
  }
});

test('botAnswerEnd 分发到 onBotAnswerEnd 并携带 payload', () => {
  const calls = [];
  dispatchTrainV2Message(
    { onBotAnswerEnd: p => calls.push(p) },
    JSON.stringify({ event: 'botAnswerEnd', payload: { content: '你好', roleNid: 'r1', roleNickname: '客户' } }),
  );
  assert.deepEqual(calls, [{ content: '你好', roleNid: 'r1', roleNickname: '客户' }]);
});

test('nextStep / selectRoleEnd / continueSuperseded / scriptEnd / error 各自分发', () => {
  const seen = [];
  const handlers = {
    onNextStep: p => seen.push(['nextStep', p.nextStepId]),
    onSelectRoleEnd: p => seen.push(['selectRoleEnd', p.roleNid]),
    onContinueSuperseded: () => seen.push(['continueSuperseded']),
    onScriptEnd: () => seen.push(['scriptEnd']),
    onServerError: p => seen.push(['error', p.msg]),
  };
  dispatchTrainV2Message(handlers, JSON.stringify({ event: 'nextStep', payload: { nextStepId: 's2' } }));
  dispatchTrainV2Message(handlers, JSON.stringify({ event: 'selectRoleEnd', payload: { roleNid: 'user' } }));
  dispatchTrainV2Message(handlers, JSON.stringify({ event: 'continueSuperseded' }));
  dispatchTrainV2Message(handlers, JSON.stringify({ event: 'scriptEnd' }));
  dispatchTrainV2Message(handlers, JSON.stringify({ event: 'error', payload: { msg: 'boom' } }));
  assert.deepEqual(seen, [
    ['nextStep', 's2'],
    ['selectRoleEnd', 'user'],
    ['continueSuperseded'],
    ['scriptEnd'],
    ['error', 'boom'],
  ]);
});

test('协议内已知忽略事件不触发 onUnknownEvent；未知事件触发', () => {
  const unknown = [];
  const handlers = { onUnknownEvent: event => unknown.push(event) };
  for (const event of ['selectRoleStart', 'botAnswer', 'audioStart', 'audioEnd', 'heartbeatAck']) {
    dispatchTrainV2Message(handlers, JSON.stringify({ event, payload: {} }));
  }
  dispatchTrainV2Message(handlers, JSON.stringify({ event: 'mystery' }));
  assert.deepEqual(unknown, ['mystery']);
});

test('坏 JSON 返回 false，合法 JSON 返回 true', () => {
  assert.equal(dispatchTrainV2Message({}, 'not-json'), false);
  assert.equal(dispatchTrainV2Message({}, JSON.stringify({ event: 'connected', payload: {} })), true);
});

test('协议常量与 auto_train_pro.py 实测一致', () => {
  assert.equal(HEARTBEAT_INTERVAL_MS, 30_000);
  assert.equal(TRAIN_V2_WS_BASE, 'wss://cloudapi.polymas.com/ai-platform/ws/trainV2');
});

test('OPEN 前 error 后 close 仍记录 handshake phase 且 connect 失败', async () => {
  const socket = createFakeSocket();
  const logs = [];
  const warn = console.warn;
  console.warn = (...args) => logs.push(args.join(' '));
  try {
    const client = new TrainV2Client(clientParams, {}, () => socket);
    const pending = client.connect();
    socket.emitError();
    socket.emitClose({ code: 1006, reason: '', wasClean: false });
    await assert.rejects(pending, /连接失败/);
  } finally {
    console.warn = warn;
  }
  assert.equal(logs.filter(log => log.includes('phase=handshake')).length, 2);
});

test('OPEN 仅启动一次并发送一次 scriptStart，close 使用 connected phase 且迟到 OPEN 不复活', async () => {
  const socket = createFakeSocket();
  const logs = [];
  const closes = [];
  const warn = console.warn;
  console.warn = (...args) => logs.push(args.join(' '));
  try {
    const client = new TrainV2Client(clientParams, { onClose: event => closes.push(event) }, () => socket);
    const pending = client.connect();
    socket.emitOpen();
    socket.emitOpen();
    await pending;
    socket.emitClose({ code: 1006, reason: '', wasClean: false });
    socket.emitOpen();
  } finally {
    console.warn = warn;
  }
  assert.deepEqual(socket.sent, ['{"event":"scriptStart"}']);
  assert.deepEqual(closes, [{ code: 1006, reason: '', wasClean: false }]);
  assert.equal(logs.filter(log => log.includes('phase=connected')).length, 1);
});

test('握手 timeout 重入只 reject/close 一次，清 timeout 且保持 handshake phase', async () => {
  await withFakeTimers(async timers => {
    const socket = createFakeSocket();
    const closes = [];
    const logs = [];
    let rejectionCount = 0;
    const warn = console.warn;
    console.warn = (...args) => logs.push(args.join(' '));
    try {
      const client = new TrainV2Client(clientParams, { onClose: event => closes.push(event) }, () => socket);
      const observed = client.connect().catch(error => {
        rejectionCount += 1;
        throw error;
      });
      const [timeoutHandle, timeoutCallback] = [...timers.timeoutCallbacks.entries()][0];
      timeoutCallback();
      timeoutCallback();

      await assert.rejects(observed, /握手超时/);
      assert.equal(rejectionCount, 1);
      assert.deepEqual(socket.closeCalls, [{ code: 4000, reason: 'handshake timeout' }]);
      assert.deepEqual(closes, [{ code: 4000, reason: 'handshake timeout', wasClean: true }]);
      assert.deepEqual(timers.clearedTimeouts, [timeoutHandle]);
      assert.equal(logs.filter(log => log.includes('phase=handshake')).length, 1);
    } finally {
      console.warn = warn;
    }
  });
});

test('握手期主动 close 同步派发 close，拒绝 pending 且迟到 OPEN 不复活', async () => {
  await withFakeTimers(async timers => {
    const socket = createFakeSocket();
    const opens = [];
    const closes = [];
    const warn = console.warn;
    console.warn = () => {};
    try {
      const client = new TrainV2Client(
        clientParams,
        { onOpen: () => opens.push('open'), onClose: event => closes.push(event) },
        () => socket,
      );
      const pending = client.connect();
      const [timeoutHandle] = [...timers.timeoutCallbacks.keys()];
      client.close(1000, 'manual stop');
      socket.emitOpen();

      await assert.rejects(pending, /握手期关闭/);
      assert.deepEqual(socket.closeCalls, [{ code: 1000, reason: 'manual stop' }]);
      assert.deepEqual(closes, [{ code: 1000, reason: 'manual stop', wasClean: true }]);
      assert.deepEqual(opens, []);
      assert.deepEqual(socket.sent, []);
      assert.deepEqual(timers.clearedTimeouts, [timeoutHandle]);
      assert.equal(timers.intervalCallbacks.size, 0);
    } finally {
      console.warn = warn;
    }
  });
});

test('OPEN 后主动 close 清理心跳，使用 connected phase 且迟到 OPEN 不重复启动', async () => {
  await withFakeTimers(async timers => {
    const socket = createFakeSocket();
    const closes = [];
    const logs = [];
    const debug = console.debug;
    console.debug = (...args) => logs.push(args.join(' '));
    try {
      const client = new TrainV2Client(clientParams, { onClose: event => closes.push(event) }, () => socket);
      const pending = client.connect();
      socket.emitOpen();
      await pending;
      const [heartbeatHandle] = [...timers.intervalCallbacks.keys()];
      client.close(1000, 'manual stop');
      socket.emitOpen();

      assert.deepEqual(socket.sent, ['{"event":"scriptStart"}']);
      assert.deepEqual(socket.closeCalls, [{ code: 1000, reason: 'manual stop' }]);
      assert.deepEqual(closes, [{ code: 1000, reason: 'manual stop', wasClean: true }]);
      assert.deepEqual(timers.clearedIntervals, [heartbeatHandle]);
      assert.equal(timers.intervalCallbacks.size, 0);
      assert.equal(logs.filter(log => log.includes('phase=connected')).length, 1);
    } finally {
      console.debug = debug;
    }
  });
});
