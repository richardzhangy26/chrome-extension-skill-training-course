import assert from 'node:assert/strict';
import test from 'node:test';
import { createLatestTaskSwitchController } from './latest-task-switch-controller.ts';

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
};

const task = taskId => ({ taskId, context: null });

test('B 名称慢于 C 时只提交后到达的 C', async () => {
  const names = { B: deferred(), C: deferred() };
  const bNameRequested = deferred();
  const persisted = [];
  const applied = [];
  let currentTaskId = null;
  const controller = createLatestTaskSwitchController({
    extractTask: async taskId => task(taskId),
    fetchTaskName: taskId => {
      if (taskId === 'B') {
        bNameRequested.resolve();
      }
      return names[taskId].promise;
    },
    persistTaskId: async taskId => {
      persisted.push(taskId);
    },
    getCurrentTaskId: () => currentTaskId,
    applyTask: result => {
      currentTaskId = result.taskId;
      applied.push(result);
    },
  });

  const switchB = controller.switchTask('B');
  await bNameRequested.promise;
  const switchC = controller.switchTask('C');
  names.C.resolve('Task C');
  await switchC;
  names.B.resolve('Task B');
  await switchB;

  assert.equal(currentTaskId, 'C');
  assert.deepEqual(persisted, ['C']);
  assert.deepEqual(
    applied.map(({ taskId, taskName }) => ({ taskId, taskName })),
    [{ taskId: 'C', taskName: 'Task C' }],
  );
});

test('B storage 慢于 C 时串行写入并让最终 storage 与 apply 都落 C', async () => {
  const bStorage = deferred();
  const bStorageStarted = deferred();
  const persistCalls = [];
  const applied = [];
  let storedTaskId = null;
  let currentTaskId = null;
  const controller = createLatestTaskSwitchController({
    extractTask: async taskId => task(taskId),
    fetchTaskName: async taskId => `Task ${taskId}`,
    persistTaskId: async taskId => {
      persistCalls.push(taskId);
      if (taskId === 'B') {
        bStorageStarted.resolve();
        await bStorage.promise;
      }
      storedTaskId = taskId;
    },
    getCurrentTaskId: () => currentTaskId,
    applyTask: result => {
      currentTaskId = result.taskId;
      applied.push(result.taskId);
    },
  });

  const switchB = controller.switchTask('B');
  await bStorageStarted.promise;
  const switchC = controller.switchTask('C');
  bStorage.resolve();
  await Promise.all([switchB, switchC]);

  assert.deepEqual(persistCalls, ['B', 'C']);
  assert.equal(storedTaskId, 'C');
  assert.equal(currentTaskId, 'C');
  assert.deepEqual(applied, ['C']);
});

test('无 task 参数时不持久化也不 apply', async () => {
  let persisted = false;
  let applied = false;
  const controller = createLatestTaskSwitchController({
    extractTask: async () => null,
    fetchTaskName: async () => 'unused',
    persistTaskId: async () => {
      persisted = true;
    },
    getCurrentTaskId: () => 'A',
    applyTask: () => {
      applied = true;
    },
  });

  await controller.switchTask('url-without-task');

  assert.equal(persisted, false);
  assert.equal(applied, false);
});

test('相同 task ID 时不持久化也不 apply', async () => {
  let persisted = false;
  let applied = false;
  const controller = createLatestTaskSwitchController({
    extractTask: async () => task('A'),
    fetchTaskName: async () => 'unused',
    persistTaskId: async () => {
      persisted = true;
    },
    getCurrentTaskId: () => 'A',
    applyTask: () => {
      applied = true;
    },
  });

  await controller.switchTask('task-a');

  assert.equal(persisted, false);
  assert.equal(applied, false);
});

test('旧任务 storage 已开始时切回当前 ID 会在队尾修复 storage 且不 apply', async () => {
  const bStorage = deferred();
  const bStorageStarted = deferred();
  const persistCalls = [];
  const applied = [];
  let storedTaskId = 'A';
  let currentTaskId = 'A';
  const controller = createLatestTaskSwitchController({
    extractTask: async taskId => task(taskId),
    fetchTaskName: async taskId => `Task ${taskId}`,
    persistTaskId: async taskId => {
      persistCalls.push(taskId);
      if (taskId === 'B') {
        bStorageStarted.resolve();
        await bStorage.promise;
      }
      storedTaskId = taskId;
    },
    getCurrentTaskId: () => currentTaskId,
    applyTask: result => {
      currentTaskId = result.taskId;
      applied.push(result.taskId);
    },
  });

  const switchB = controller.switchTask('B');
  await bStorageStarted.promise;
  const switchBackToA = controller.switchTask('A');
  bStorage.resolve();
  await Promise.all([switchB, switchBackToA]);

  assert.deepEqual(persistCalls, ['B', 'A']);
  assert.equal(storedTaskId, 'A');
  assert.equal(currentTaskId, 'A');
  assert.deepEqual(applied, []);
});

test('旧任务 storage 已开始后收到无 task 事件会保留当前任务并修复 storage', async () => {
  const bStorage = deferred();
  const bStorageStarted = deferred();
  const noTaskExtract = deferred();
  const persistCalls = [];
  const applied = [];
  let storedTaskId = 'A';
  const currentTaskId = 'A';
  const controller = createLatestTaskSwitchController({
    extractTask: taskId => (taskId ? Promise.resolve(task(taskId)) : noTaskExtract.promise),
    fetchTaskName: async taskId => `Task ${taskId}`,
    persistTaskId: async taskId => {
      persistCalls.push(taskId);
      if (taskId === 'B') {
        bStorageStarted.resolve();
        await bStorage.promise;
      }
      storedTaskId = taskId;
    },
    getCurrentTaskId: () => currentTaskId,
    applyTask: result => {
      applied.push(result.taskId);
    },
  });

  const switchB = controller.switchTask('B');
  await bStorageStarted.promise;
  const switchToNoTask = controller.switchTask(null);
  bStorage.resolve();
  await switchB;
  noTaskExtract.resolve(null);
  await switchToNoTask;

  assert.deepEqual(persistCalls, ['B', 'A']);
  assert.equal(storedTaskId, 'A');
  assert.equal(currentTaskId, 'A');
  assert.deepEqual(applied, []);
});
