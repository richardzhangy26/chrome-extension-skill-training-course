import assert from 'node:assert/strict';
import test from 'node:test';
import { createPolymasUserInfoLoader } from './polymas-user-service.ts';

const userInfo = userId => ({ userId, schoolId: 'school-1' });

test('普通 fetch 复用 cache，refresh 强制读取新账号', async () => {
  const responses = [userInfo('account-a'), userInfo('account-b')];
  let requestCount = 0;
  const loader = createPolymasUserInfoLoader(async () => {
    const response = responses[requestCount];
    requestCount += 1;
    return response;
  });

  assert.equal((await loader.fetch()).userId, 'account-a');
  assert.equal((await loader.fetch()).userId, 'account-a');
  assert.equal((await loader.refresh()).userId, 'account-b');
  assert.equal(requestCount, 2);
});

test('旧请求失败不会清除更新后的新账号 promise', async () => {
  let rejectOld;
  let resolveFresh;
  let requestCount = 0;
  const loader = createPolymasUserInfoLoader(
    () =>
      new Promise((resolve, reject) => {
        requestCount += 1;
        if (requestCount === 1) {
          rejectOld = reject;
        } else {
          resolveFresh = resolve;
        }
      }),
  );

  const old = loader.fetch();
  const fresh = loader.refresh();
  rejectOld(new Error('old request failed'));
  resolveFresh(userInfo('account-b'));

  await assert.rejects(old, /old request failed/);
  assert.equal((await fresh).userId, 'account-b');
  assert.equal((await loader.fetch()).userId, 'account-b');
  assert.equal(requestCount, 2);
});

test('fetcher 同步抛错时 fetch 返回 rejected Promise', async () => {
  const loader = createPolymasUserInfoLoader(() => {
    throw new Error('sync fetch failed');
  });

  const request = loader.fetch();

  assert.ok(request instanceof Promise);
  await assert.rejects(request, /sync fetch failed/);
});

test('较旧 refresh 后完成不会覆盖最新账号 promise', async () => {
  let resolveOld;
  let resolveLatest;
  let requestCount = 0;
  const loader = createPolymasUserInfoLoader(
    () =>
      new Promise(resolve => {
        requestCount += 1;
        if (requestCount === 1) {
          resolveOld = resolve;
        } else {
          resolveLatest = resolve;
        }
      }),
  );

  const old = loader.refresh();
  const latest = loader.refresh();
  resolveLatest(userInfo('account-c'));
  resolveOld(userInfo('account-b'));

  assert.equal((await latest).userId, 'account-c');
  assert.equal((await old).userId, 'account-b');
  assert.equal((await loader.fetch()).userId, 'account-c');
});

test('较旧 refresh 后失败不会清除最新账号 promise', async () => {
  let rejectOld;
  let resolveLatest;
  let requestCount = 0;
  const loader = createPolymasUserInfoLoader(
    () =>
      new Promise((resolve, reject) => {
        requestCount += 1;
        if (requestCount === 1) {
          rejectOld = reject;
        } else {
          resolveLatest = resolve;
        }
      }),
  );

  const old = loader.refresh();
  const latest = loader.refresh();
  rejectOld(new Error('stale refresh failed'));
  resolveLatest(userInfo('account-c'));

  await assert.rejects(old, /stale refresh failed/);
  assert.equal((await latest).userId, 'account-c');
  assert.equal((await loader.fetch()).userId, 'account-c');
});

test('invalidate 使下一次 fetch 重新读取账号', async () => {
  const responses = [userInfo('account-a'), userInfo('account-b')];
  let requestCount = 0;
  const loader = createPolymasUserInfoLoader(async () => {
    const response = responses[requestCount];
    requestCount += 1;
    return response;
  });

  await loader.fetch();
  loader.invalidate();

  assert.equal((await loader.fetch()).userId, 'account-b');
  assert.equal(requestCount, 2);
});
