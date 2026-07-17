import { connectProTrainV2Page } from '../background-bridge';

const PROTOCOL = 'polymas-pro-train-v2' as const;
const VERSION = 1 as const;
const TRAIN_V2_SOCKET_STATE = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSED: 3,
} as const;

interface TrainV2ConnectionParams {
  taskId: string;
  userId: string;
  sessionId: string;
}

interface TrainV2CloseInfo {
  code: number;
  reason: string;
  wasClean: boolean;
}

interface TrainV2Socket {
  binaryType: BinaryType;
  readonly readyState: number;
  addEventListener(type: 'open' | 'message' | 'error' | 'close', listener: (event: unknown) => void): void;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

interface ListenerEvent<T> {
  addListener(listener: T): void;
  removeListener(listener: T): void;
}

interface RelayPort {
  onMessage: ListenerEvent<(message: unknown) => void>;
  onDisconnect: ListenerEvent<() => void>;
  postMessage(message: unknown): void;
  disconnect(): void;
}

type TrainV2SocketFactory = (params: TrainV2ConnectionParams) => TrainV2Socket;

interface PageRelayDependencies {
  connectPort: () => Promise<RelayPort>;
  connectionId: () => string;
  readLastError: () => string | undefined;
}

type PageEvent =
  | { connectionId: string; type: 'OPEN' | 'ERROR' }
  | { connectionId: string; type: 'TEXT'; payload: { data: string } }
  | { connectionId: string; type: 'BINARY'; payload: { byteLength: number } }
  | { connectionId: string; type: 'CLOSE'; payload: TrainV2CloseInfo };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasOnlyKeys = (value: Record<string, unknown>, allowed: string[]): boolean =>
  Object.keys(value).every(key => allowed.includes(key));

const isPageEvent = (value: unknown): value is PageEvent => {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['protocol', 'version', 'direction', 'connectionId', 'type', 'payload']) ||
    value.protocol !== PROTOCOL ||
    value.version !== VERSION ||
    value.direction !== 'page-to-extension' ||
    typeof value.connectionId !== 'string'
  ) {
    return false;
  }
  switch (value.type) {
    case 'OPEN':
    case 'ERROR':
      return value.payload === undefined;
    case 'TEXT':
      return isRecord(value.payload) && hasOnlyKeys(value.payload, ['data']) && typeof value.payload.data === 'string';
    case 'BINARY':
      return (
        isRecord(value.payload) &&
        hasOnlyKeys(value.payload, ['byteLength']) &&
        typeof value.payload.byteLength === 'number' &&
        Number.isInteger(value.payload.byteLength) &&
        value.payload.byteLength >= 0
      );
    case 'CLOSE':
      return (
        isRecord(value.payload) &&
        hasOnlyKeys(value.payload, ['code', 'reason', 'wasClean']) &&
        typeof value.payload.code === 'number' &&
        Number.isInteger(value.payload.code) &&
        value.payload.code >= 0 &&
        value.payload.code <= 4999 &&
        typeof value.payload.reason === 'string' &&
        typeof value.payload.wasClean === 'boolean'
      );
    default:
      return false;
  }
};

const createConnectionId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `relay_${Date.now()}_${Math.random().toString(36).slice(2)}`;

const readRuntimeLastError = (): string | undefined => {
  if (typeof chrome === 'undefined') return undefined;
  return chrome.runtime.lastError?.message;
};

const createTrainV2PageRelaySocket = (
  params: TrainV2ConnectionParams,
  overrides?: Partial<PageRelayDependencies>,
): TrainV2Socket => {
  const dependencies: PageRelayDependencies = {
    connectPort: connectProTrainV2Page,
    connectionId: createConnectionId,
    readLastError: readRuntimeLastError,
    ...overrides,
  };
  const connectionId = dependencies.connectionId();
  const listeners = new Map<string, Set<(event: unknown) => void>>();
  let readyState: number = TRAIN_V2_SOCKET_STATE.CONNECTING;
  let port: RelayPort | null = null;
  let terminal = false;
  let attached = false;

  const emit = (type: 'open' | 'message' | 'error' | 'close', event: unknown): void => {
    for (const listener of listeners.get(type) ?? []) listener(event);
  };

  const onPortMessage = (message: unknown): void => {
    if (terminal || !isPageEvent(message) || message.connectionId !== connectionId) return;
    switch (message.type) {
      case 'OPEN':
        if (readyState !== TRAIN_V2_SOCKET_STATE.CONNECTING) return;
        readyState = TRAIN_V2_SOCKET_STATE.OPEN;
        emit('open', {});
        return;
      case 'TEXT':
        if (readyState === TRAIN_V2_SOCKET_STATE.OPEN) emit('message', { data: message.payload.data });
        return;
      case 'BINARY':
        if (readyState === TRAIN_V2_SOCKET_STATE.OPEN) emit('message', { data: new ArrayBuffer(0) });
        return;
      case 'ERROR':
        finishTerminal({ code: 1006, reason: '能力训练 Pro 页面连接失败，请刷新页面后重试', wasClean: false }, true);
        return;
      case 'CLOSE':
        finishTerminal(message.payload, false);
        return;
    }
  };

  const detachPort = (): void => {
    if (!port || !attached) return;
    port.onMessage.removeListener(onPortMessage);
    port.onDisconnect.removeListener(onPortDisconnect);
    attached = false;
  };

  const disconnectPort = (): void => {
    if (!port) return;
    const activePort = port;
    port = null;
    detachPort();
    try {
      activePort.disconnect();
    } catch {
      // Port 已经断开时不应影响终态清理。
    }
  };

  const finishTerminal = (close: TrainV2CloseInfo, emitError: boolean): void => {
    if (terminal) return;
    terminal = true;
    readyState = TRAIN_V2_SOCKET_STATE.CLOSED;
    detachPort();
    if (emitError) emit('error', {});
    emit('close', close);
    disconnectPort();
  };

  const onPortDisconnect = (): void => {
    if (terminal) return;
    const lastError = dependencies.readLastError();
    const reason = lastError ? '请刷新能力训练 Pro 页面后重试' : '能力训练 Pro 页面连接已断开，请刷新页面后重试';
    finishTerminal({ code: 1006, reason, wasClean: false }, true);
  };

  void dependencies
    .connectPort()
    .then(connectedPort => {
      if (terminal) {
        try {
          connectedPort.disconnect();
        } catch {
          // 已断开的迟到 Port 无需额外处理。
        }
        return;
      }
      port = connectedPort;
      connectedPort.onMessage.addListener(onPortMessage);
      connectedPort.onDisconnect.addListener(onPortDisconnect);
      attached = true;
      try {
        connectedPort.postMessage({
          protocol: PROTOCOL,
          version: VERSION,
          direction: 'extension-to-page',
          connectionId,
          type: 'CONNECT',
          payload: params,
        });
      } catch {
        finishTerminal({ code: 1006, reason: '请刷新能力训练 Pro 页面后重试', wasClean: false }, true);
      }
    })
    .catch(() => {
      finishTerminal({ code: 1006, reason: '请刷新能力训练 Pro 页面后重试', wasClean: false }, true);
    });

  return {
    binaryType: 'arraybuffer',
    get readyState() {
      return readyState;
    },
    addEventListener(type, listener) {
      const typeListeners = listeners.get(type) ?? new Set();
      typeListeners.add(listener);
      listeners.set(type, typeListeners);
    },
    send(data) {
      if (terminal || readyState !== TRAIN_V2_SOCKET_STATE.OPEN || !port) return;
      try {
        port.postMessage({
          protocol: PROTOCOL,
          version: VERSION,
          direction: 'extension-to-page',
          connectionId,
          type: 'SEND',
          payload: { data },
        });
      } catch {
        finishTerminal({ code: 1006, reason: '请刷新能力训练 Pro 页面后重试', wasClean: false }, true);
      }
    },
    close(code = 1000, reason = 'client close') {
      if (terminal) return;
      if (port) {
        try {
          port.postMessage({
            protocol: PROTOCOL,
            version: VERSION,
            direction: 'extension-to-page',
            connectionId,
            type: 'CLOSE',
            payload: { code, reason },
          });
        } catch {
          // 无法通知页面时仍需释放本地 Port。
        }
      }
      finishTerminal({ code, reason, wasClean: true }, false);
    },
  };
};

export { createTrainV2PageRelaySocket, TRAIN_V2_SOCKET_STATE };
export type { TrainV2CloseInfo, TrainV2ConnectionParams, TrainV2Socket, TrainV2SocketFactory };
