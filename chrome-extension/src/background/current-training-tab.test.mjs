import assert from 'node:assert/strict';
import test from 'node:test';

import { toCurrentTrainingTab } from './current-training-tab.ts';

test('只接受精确 HTTPS teaching-center hostname', () => {
  assert.deepEqual(toCurrentTrainingTab({ id: 1, url: 'https://hike-teaching-center.polymas.com/x' }), {
    id: 1,
    url: 'https://hike-teaching-center.polymas.com/x',
  });
  assert.equal(toCurrentTrainingTab({ id: 1, url: 'https://hike-teaching-center.polymas.com.evil/x' }), null);
  assert.equal(toCurrentTrainingTab({ id: 1, url: 'http://hike-teaching-center.polymas.com/x' }), null);
});

test('无标签 id、URL 或非法 URL 时拒绝', () => {
  assert.equal(toCurrentTrainingTab({ id: undefined, url: 'https://hike-teaching-center.polymas.com/x' }), null);
  assert.equal(toCurrentTrainingTab({ id: 1, url: undefined }), null);
  assert.equal(toCurrentTrainingTab({ id: 1, url: 'not a url' }), null);
});
