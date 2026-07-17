import assert from 'node:assert/strict';
import test from 'node:test';

import { createTrainingTabUrlEventController } from './training-tab-url-events.ts';

const trainingUrl = taskId =>
  `https://hike-teaching-center.polymas.com/tch-hike/ability-training-pro/create?trainTaskId=${taskId}`;

test('onUpdated 只发布活动教学标签的新 URL', async () => {
  const published = [];
  const controller = createTrainingTabUrlEventController({
    getTab: async () => ({ id: 1, url: trainingUrl('A') }),
    publish: event => published.push(event),
  });

  await controller.onUpdated(2, { url: trainingUrl('B') }, { active: false });
  await controller.onUpdated(1, { url: trainingUrl('A') }, { active: true });
  await controller.onUpdated(1, {}, { active: true });

  assert.deepEqual(published, [{ id: 1, url: trainingUrl('A') }]);
});

test('onActivated 发布被激活标签的当前教学 URL', async () => {
  const published = [];
  const controller = createTrainingTabUrlEventController({
    getTab: async tabId => ({ id: tabId, url: trainingUrl('B') }),
    publish: event => published.push(event),
  });

  await controller.onActivated({ tabId: 2 });

  assert.deepEqual(published, [{ id: 2, url: trainingUrl('B') }]);
});

test('激活非教学标签或 getTab 失败时不发布', async () => {
  const published = [];
  const nonTraining = createTrainingTabUrlEventController({
    getTab: async tabId => ({ id: tabId, url: 'https://example.com/' }),
    publish: event => published.push(event),
  });
  const failed = createTrainingTabUrlEventController({
    getTab: async () => {
      throw new Error('tab closed');
    },
    publish: event => published.push(event),
  });

  await nonTraining.onActivated({ tabId: 3 });
  await failed.onActivated({ tabId: 4 });

  assert.deepEqual(published, []);
});
