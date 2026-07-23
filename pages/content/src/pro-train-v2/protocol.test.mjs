import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PRO_TRAIN_V2_PORT_NAME,
  buildTrainV2Url,
  isAllowedTrainV2Payload,
  isProTrainV2Command,
  isProTrainV2PageEvent,
  readTaskIdFromPageUrl,
} from './protocol.ts';

const command = (type, payload, connectionId = 'connection-1') => ({
  protocol: PRO_TRAIN_V2_PORT_NAME,
  version: 1,
  direction: 'extension-to-page',
  connectionId,
  type,
  ...(payload === undefined ? {} : { payload }),
});

test('CONNECT 只接受当前页面的 Pro taskId 与三个非空标识', () => {
  assert.equal(isProTrainV2Command(command('CONNECT', { taskId: 'PRO123', userId: 'u1', sessionId: 's1' })), true);
  assert.equal(isProTrainV2Command(command('CONNECT', { taskId: 'BAD', userId: 'u1', sessionId: 's1' })), false);
  assert.equal(isProTrainV2Command(command('CONNECT', { taskId: 'PRO123', userId: '', sessionId: 's1' })), false);
  assert.equal(isProTrainV2Command(command('CONNECT', { taskId: 'PRO123', userId: 'u1', sessionId: 's1' }, '')), false);
});

test('SEND 只接受五种既定事件和合法 payload', () => {
  assert.equal(isAllowedTrainV2Payload('{"event":"stepStart","payload":{"stepId":"s1"}}'), true);
  assert.equal(isAllowedTrainV2Payload('{"event":"unknown"}'), false);
  assert.equal(isAllowedTrainV2Payload('not json'), false);
  assert.equal(isProTrainV2Command(command('SEND', { data: '{"event":"audio"}' })), false);
  assert.equal(
    isAllowedTrainV2Payload('{"event":"userTextInput","payload":{"text":"你好","Authorization":"secret"}}'),
    false,
  );
});

test('URL 只能由固定 base 和三个参数构造', () => {
  assert.equal(
    buildTrainV2Url({ taskId: 'PRO123', userId: 'u1', sessionId: 's1' }),
    'wss://cloudapi.polymas.com/ai-platform/ws/trainV2?taskId=PRO123&userId=u1&sessionId=s1',
  );
});

test('页面 URL 只读取 trainTaskId 或 taskId 的 PRO 标识', () => {
  assert.equal(readTaskIdFromPageUrl('https://hike-teaching-center.polymas.com/training?trainTaskId=PRO123'), 'PRO123');
  assert.equal(readTaskIdFromPageUrl('https://hike-teaching-center.polymas.com/training?taskId=PRO456'), 'PRO456');
  assert.equal(readTaskIdFromPageUrl('https://hike-teaching-center.polymas.com/training?taskId=bad'), null);
});

test('页面事件严格校验协议方向与消息形状', () => {
  assert.equal(
    isProTrainV2PageEvent({
      protocol: PRO_TRAIN_V2_PORT_NAME,
      version: 1,
      direction: 'page-to-extension',
      connectionId: 'connection-1',
      type: 'CLOSE',
      payload: { code: 1000, reason: '', wasClean: true },
    }),
    true,
  );
  assert.equal(
    isProTrainV2PageEvent({
      protocol: PRO_TRAIN_V2_PORT_NAME,
      version: 1,
      direction: 'page-to-extension',
      connectionId: 'connection-1',
      type: 'TEXT',
      payload: { data: 1 },
    }),
    false,
  );
});

test('envelope 与所有命令、页面事件 payload 都拒绝额外敏感字段', () => {
  const validConnect = command('CONNECT', { taskId: 'PRO123', userId: 'u1', sessionId: 's1' });
  assert.equal(isProTrainV2Command({ ...validConnect, Authorization: 'secret' }), false);
  assert.equal(isProTrainV2Command(command('CONNECT', { ...validConnect.payload, cookie: 'secret' })), false);
  assert.equal(isProTrainV2Command(command('SEND', { data: '{"event":"scriptStart"}', token: 'secret' })), false);
  assert.equal(isProTrainV2Command(command('CLOSE', { code: 1000, reason: 'done', Cookie: 'secret' })), false);

  const pageEvent = (type, payload) => ({
    protocol: PRO_TRAIN_V2_PORT_NAME,
    version: 1,
    direction: 'page-to-extension',
    connectionId: 'connection-1',
    type,
    payload,
  });
  assert.equal(isProTrainV2PageEvent(pageEvent('OPEN', {})), false);
  assert.equal(isProTrainV2PageEvent(pageEvent('ERROR', { Authorization: 'secret' })), false);
  assert.equal(isProTrainV2PageEvent(pageEvent('TEXT', { data: 'hello', token: 'secret' })), false);
  assert.equal(isProTrainV2PageEvent(pageEvent('BINARY', { byteLength: 1, audio: 'secret' })), false);
  assert.equal(
    isProTrainV2PageEvent(pageEvent('CLOSE', { code: 1000, reason: 'done', wasClean: true, Cookie: 'secret' })),
    false,
  );
});

test('CLOSE reason 按 UTF-8 字节限制为 123 bytes', () => {
  assert.equal(isProTrainV2Command(command('CLOSE', { code: 1000, reason: '😀'.repeat(60) })), false);
  assert.equal(isProTrainV2Command(command('CLOSE', { code: 1000, reason: 'a'.repeat(123) })), true);
  assert.equal(isProTrainV2Command(command('CLOSE', { code: 1000, reason: 'a'.repeat(124) })), false);
});
