/**
 * 防节流 sleep：计时跑在 dedicated Worker 里（见 pacer-worker.ts），页面隐藏时
 * 不会像主线程 setTimeout 一样被 Chrome 节流到 1 次/秒甚至 1 次/分钟。
 * Worker 不可用（如 CSP 限制）时回退主线程 setTimeout。
 * 传入 AbortSignal 时，signal 触发会让 sleep 立即结束（resolve，不 reject）。
 */

let workerInstance: Worker | null = null;
let workerFailed = false;
let nextSleepId = 1;
const pendingSleeps = new Map<number, () => void>();

const getWorker = (): Worker | null => {
  if (workerInstance || workerFailed) {
    return workerInstance;
  }
  try {
    workerInstance = new Worker(new URL('./pacer-worker.ts', import.meta.url));
    workerInstance.onmessage = (event: MessageEvent<number>) => {
      const settle = pendingSleeps.get(event.data);
      if (settle) {
        pendingSleeps.delete(event.data);
        settle();
      }
    };
    workerInstance.onerror = () => {
      // Worker 加载/运行失败：回退主线程定时器，并提前唤醒所有等待者避免悬挂
      console.warn('[timing] pacer worker 不可用，回退主线程 setTimeout（页面隐藏时可能被节流）');
      workerFailed = true;
      workerInstance?.terminate();
      workerInstance = null;
      const settlers = [...pendingSleeps.values()];
      pendingSleeps.clear();
      for (const settle of settlers) {
        settle();
      }
    };
  } catch {
    workerFailed = true;
    workerInstance = null;
  }
  return workerInstance;
};

const throttleSafeSleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise(resolve => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    let settled = false;
    let cancel: () => void = () => {};
    let removeAbortListener: () => void = () => {};
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      removeAbortListener();
      resolve();
    };
    const onAbort = () => {
      cancel();
      finish();
    };
    removeAbortListener = () => {
      signal?.removeEventListener('abort', onAbort);
    };
    const worker = getWorker();
    if (worker) {
      const id = nextSleepId;
      nextSleepId += 1;
      pendingSleeps.set(id, finish);
      cancel = () => {
        pendingSleeps.delete(id);
      };
      worker.postMessage({ id, ms });
    } else {
      const timer = setTimeout(finish, ms);
      cancel = () => {
        clearTimeout(timer);
      };
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });

export { throttleSafeSleep };
