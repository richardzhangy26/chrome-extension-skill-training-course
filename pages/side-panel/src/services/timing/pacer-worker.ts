/**
 * 计时 Worker：接收 { id, ms }，ms 毫秒后把 id 发回主线程。
 * Chrome 会对隐藏页面（窗口最小化/被完全遮挡/息屏）主线程的定时器节流：
 * 约 1 次/秒，隐藏超 5 分钟后链式定时器进一步降到约 1 次/分钟；
 * dedicated Worker 的定时器不在该 per-Window 节流范围内，所以把计时挪到这里。
 */

interface SleepRequest {
  id: number;
  ms: number;
}

interface WorkerScope {
  onmessage: ((event: MessageEvent<SleepRequest>) => void) | null;
  postMessage: (message: number) => void;
}

const scope = self as unknown as WorkerScope;

scope.onmessage = event => {
  const { id, ms } = event.data;
  setTimeout(() => scope.postMessage(id), ms);
};

export {};
