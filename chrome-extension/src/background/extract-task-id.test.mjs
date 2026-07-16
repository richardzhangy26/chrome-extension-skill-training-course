import assert from 'node:assert/strict';
import test from 'node:test';
import { readTaskIdFromUrl } from './extract-task-id.ts';

test('普通训练页：读取 trainTaskId', () => {
  assert.equal(readTaskIdFromUrl('https://x.com/train?trainTaskId=ABC123'), 'ABC123');
});

test('Pro 运行页：回退读取 taskId', () => {
  assert.equal(readTaskIdFromUrl('https://x.com/pro?taskId=PROuNODZ41RAJttrEuzs'), 'PROuNODZ41RAJttrEuzs');
});

test('两者都有时 trainTaskId 优先', () => {
  assert.equal(readTaskIdFromUrl('https://x.com/p?taskId=T2&trainTaskId=T1'), 'T1');
});

test('都没有返回 null', () => {
  assert.equal(readTaskIdFromUrl('https://x.com/p?foo=bar'), null);
});

test('非法 URL 返回 null', () => {
  assert.equal(readTaskIdFromUrl('not a url'), null);
});
