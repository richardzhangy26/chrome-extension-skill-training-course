import assert from 'node:assert/strict';
import test from 'node:test';

import { getRuntimeLastErrorMessage } from './background-bridge.ts';

test('runtime lastError 由 background bridge 统一读取', () => {
  const originalChrome = globalThis.chrome;
  globalThis.chrome = { runtime: { lastError: { message: 'port disconnected' } } };

  try {
    assert.equal(getRuntimeLastErrorMessage(), 'port disconnected');
    globalThis.chrome.runtime.lastError = undefined;
    assert.equal(getRuntimeLastErrorMessage(), undefined);
    globalThis.chrome = undefined;
    assert.equal(getRuntimeLastErrorMessage(), undefined);
  } finally {
    globalThis.chrome = originalChrome;
  }
});
