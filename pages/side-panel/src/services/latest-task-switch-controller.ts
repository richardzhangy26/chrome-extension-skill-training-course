interface TaskSwitchCandidate<TContext> {
  taskId: string;
  context: TContext;
}

interface TaskSwitchResult<TContext> extends TaskSwitchCandidate<TContext> {
  taskName: string | undefined;
}

interface LatestTaskSwitchControllerOptions<TInput, TContext> {
  extractTask: (input: TInput, isLatest: () => boolean) => Promise<TaskSwitchCandidate<TContext> | null>;
  fetchTaskName: (taskId: string) => Promise<string | undefined>;
  persistTaskId: (taskId: string) => Promise<void>;
  getCurrentTaskId: () => string | null;
  applyTask: (result: TaskSwitchResult<TContext>) => void;
}

const createLatestTaskSwitchController = <TInput, TContext>({
  extractTask,
  fetchTaskName,
  persistTaskId,
  getCurrentTaskId,
  applyTask,
}: LatestTaskSwitchControllerOptions<TInput, TContext>) => {
  let generation = 0;
  let commitTail = Promise.resolve();
  let lastPersistedTaskId: string | null = null;
  let pendingCommitCount = 0;

  const enqueueCommit = (commit: () => Promise<void>) => {
    pendingCommitCount += 1;
    const queued = commitTail.then(commit, commit);
    commitTail = queued.then(
      () => {
        pendingCommitCount -= 1;
      },
      () => {
        pendingCommitCount -= 1;
      },
    );
    return queued;
  };

  const persistKnownTaskId = async (taskId: string) => {
    await Promise.resolve().then(() => persistTaskId(taskId));
    lastPersistedTaskId = taskId;
  };

  const repairCurrentTaskIfNeeded = async (isLatest: () => boolean) => {
    const currentTaskId = getCurrentTaskId();
    const storageMayDiverge =
      pendingCommitCount > 0 || (lastPersistedTaskId !== null && lastPersistedTaskId !== currentTaskId);
    if (!currentTaskId || !storageMayDiverge) {
      return;
    }
    await enqueueCommit(async () => {
      if (!isLatest()) {
        return;
      }
      await persistKnownTaskId(currentTaskId);
      if (!isLatest()) {
        return;
      }
    });
  };

  const switchTask = async (input: TInput) => {
    const requestGeneration = ++generation;
    const isLatest = () => requestGeneration === generation;
    const candidate = await Promise.resolve().then(() => extractTask(input, isLatest));
    if (!isLatest()) {
      return;
    }
    if (!candidate || candidate.taskId === getCurrentTaskId()) {
      await repairCurrentTaskIfNeeded(isLatest);
      return;
    }

    const taskName = await Promise.resolve().then(() => fetchTaskName(candidate.taskId));
    if (!isLatest()) {
      return;
    }

    await enqueueCommit(async () => {
      if (!isLatest() || candidate.taskId === getCurrentTaskId()) {
        return;
      }
      await persistKnownTaskId(candidate.taskId);
      if (!isLatest() || candidate.taskId === getCurrentTaskId()) {
        return;
      }
      applyTask({ ...candidate, taskName });
    });
  };

  const invalidate = () => {
    generation += 1;
  };

  return { invalidate, switchTask };
};

export { createLatestTaskSwitchController };
export type { LatestTaskSwitchControllerOptions, TaskSwitchCandidate, TaskSwitchResult };
