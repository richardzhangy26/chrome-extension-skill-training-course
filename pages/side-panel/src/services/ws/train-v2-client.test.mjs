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

// 受控 sleep：注入 TrainV2Client 替代 throttleSafeSleep，不建真实定时器。
// 记录每次调用的 { ms, resolve }，仅在 abort 时自行结束（对齐 throttleSafeSleep 的 signal 语义）。
const createSleepController = () => {
  const calls = [];
  const sleep = (ms, signal) =>
    new Promise(resolve => {
      calls.push({ ms, resolve });
      if (signal?.aborted) {
        resolve();
        return;
      }
      signal?.addEventListener('abort', () => resolve(), { once: true });
    });
  return { sleep, calls };
};

// 让被 resolve 的 sleep 之后的异步循环续体跑到下一个 await
const tick = () => new Promise(resolve => globalThis.setTimeout(resolve, 0));

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

test('握手超时：无 OPEN 时到时只 reject/close 一次，保持 handshake phase', async () => {
  const socket = createFakeSocket();
  const { sleep, calls } = createSleepController();
  const closes = [];
  const logs = [];
  let rejectionCount = 0;
  const warn = console.warn;
  console.warn = (...args) => logs.push(args.join(' '));
  try {
    const client = new TrainV2Client(clientParams, { onClose: event => closes.push(event) }, () => socket, sleep);
    const observed = client.connect().catch(error => {
      rejectionCount += 1;
      throw error;
    });
    // OPEN 之前仅有握手超时这一个等待中的 sleep
    assert.equal(calls.length, 1);
    calls[0].resolve();
    calls[0].resolve(); // 重入：Promise 只结算一次 + settled 兜底，仅 reject/close 一次

    await assert.rejects(observed, /握手超时/);
    assert.equal(rejectionCount, 1);
    assert.deepEqual(socket.closeCalls, [{ code: 4000, reason: 'handshake timeout' }]);
    assert.deepEqual(closes, [{ code: 4000, reason: 'handshake timeout', wasClean: true }]);
    assert.equal(logs.filter(log => log.includes('phase=handshake')).length, 1);
  } finally {
    console.warn = warn;
  }
});

test('握手期主动 close 同步派发 close，拒绝 pending 且迟到 OPEN 不复活', async () => {
  const socket = createFakeSocket();
  const { sleep } = createSleepController();
  const opens = [];
  const closes = [];
  const warn = console.warn;
  console.warn = () => {};
  try {
    const client = new TrainV2Client(
      clientParams,
      { onOpen: () => opens.push('open'), onClose: event => closes.push(event) },
      () => socket,
      sleep,
    );
    const pending = client.connect();
    client.close(1000, 'manual stop');
    socket.emitOpen();

    await assert.rejects(pending, /握手期关闭/);
    assert.deepEqual(socket.closeCalls, [{ code: 1000, reason: 'manual stop' }]);
    assert.deepEqual(closes, [{ code: 1000, reason: 'manual stop', wasClean: true }]);
    assert.deepEqual(opens, []);
    assert.deepEqual(socket.sent, []);
  } finally {
    console.warn = warn;
  }
});

test('OPEN 后主动 close 停止心跳循环，使用 connected phase 且迟到 OPEN 不重启', async () => {
  const socket = createFakeSocket();
  const { sleep, calls } = createSleepController();
  const closes = [];
  const logs = [];
  const debug = console.debug;
  console.debug = (...args) => logs.push(args.join(' '));
  try {
    const client = new TrainV2Client(clientParams, { onClose: event => closes.push(event) }, () => socket, sleep);
    const pending = client.connect();
    socket.emitOpen();
    await pending;

    const heartbeatWaits = () => calls.filter(c => c.ms === HEARTBEAT_INTERVAL_MS);
    assert.equal(heartbeatWaits().length, 1);

    client.close(1000, 'manual stop');
    socket.emitOpen(); // 迟到 OPEN
    await tick();

    assert.deepEqual(socket.sent, ['{"event":"scriptStart"}']);
    assert.deepEqual(socket.closeCalls, [{ code: 1000, reason: 'manual stop' }]);
    assert.deepEqual(closes, [{ code: 1000, reason: 'manual stop', wasClean: true }]);
    // 迟到 OPEN 不重启心跳：循环已因 abort 退出，未新增等待中的 sleep
    assert.equal(heartbeatWaits().length, 1);
    assert.equal(logs.filter(log => log.includes('phase=connected')).length, 1);
  } finally {
    console.debug = debug;
  }
});

test('心跳走注入的防节流 sleep：按 30s 间隔重复发送 heartBeat，close 后停止', async () => {
  const socket = createFakeSocket();
  const { sleep, calls } = createSleepController();
  const client = new TrainV2Client(clientParams, {}, () => socket, sleep);
  const pending = client.connect();
  socket.emitOpen();
  await pending;

  const heartbeatWaits = () => calls.filter(c => c.ms === HEARTBEAT_INTERVAL_MS);
  const heartbeatsSent = () => socket.sent.filter(s => s.includes('heartBeat')).length;

  // open 后：心跳循环已在等待一次 30s sleep，此时仅发过 scriptStart
  assert.equal(heartbeatWaits().length, 1);
  assert.deepEqual(socket.sent, ['{"event":"scriptStart"}']);

  // 推进一次 30s：发送一次 heartBeat 并续期
  heartbeatWaits().at(-1).resolve();
  await tick();
  assert.equal(heartbeatsSent(), 1);
  assert.equal(heartbeatWaits().length, 2);

  // 再推进一次：再发送一次并续期
  heartbeatWaits().at(-1).resolve();
  await tick();
  assert.equal(heartbeatsSent(), 2);
  assert.equal(heartbeatWaits().length, 3);

  // close 后：等待中的 sleep 被 abort，循环退出，不再发送也不再新建 sleep
  const waitsBeforeClose = heartbeatWaits().length;
  client.close();
  await tick();
  assert.equal(heartbeatsSent(), 2);
  assert.equal(heartbeatWaits().length, waitsBeforeClose);
});
