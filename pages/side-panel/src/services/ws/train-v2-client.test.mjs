import assert from 'node:assert/strict';
import test from 'node:test';
import { dispatchTrainV2Message, HEARTBEAT_INTERVAL_MS, TRAIN_V2_WS_BASE } from './train-v2-client.ts';

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
