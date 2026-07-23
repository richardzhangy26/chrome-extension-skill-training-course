import assert from 'node:assert/strict';
import test from 'node:test';

import { createProTaskChangeTracker } from './pro-task-change-tracker.ts';

test('初始/相同 task 不触发，A→B 与 B→空 task 各触发一次', () => {
  const tracker = createProTaskChangeTracker('A');

  assert.equal(tracker.update('A'), false);
  assert.equal(tracker.update('B'), true);
  assert.equal(tracker.update('B'), false);
  assert.equal(tracker.update(null), true);
  assert.equal(tracker.update(null), false);
});
