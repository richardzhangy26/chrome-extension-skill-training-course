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
