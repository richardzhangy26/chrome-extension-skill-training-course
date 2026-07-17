import { PROTOCOL, VERSION, buildTrainV2Url, isAllowedTrainV2Payload, readTaskIdFromPageUrl } from './protocol';
import type { ProTrainV2Command, ProTrainV2PageEvent } from './protocol';

interface SocketLike {
  binaryType: BinaryType;
  close(code?: number, reason?: string): void;
  send(data: string): void;
  addEventListener(type: 'open' | 'message' | 'error' | 'close', listener: (event: unknown) => void): void;
}

interface PageWsController {
  handle(command: ProTrainV2Command): void;
  dispose(): void;
}

interface Dependencies {
  createSocket(url: string): SocketLike;
  emit(event: ProTrainV2PageEvent): void;
  getCurrentPageUrl(): string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getBinaryByteLength = (value: unknown): number | null => {
  if (value instanceof ArrayBuffer) return value.byteLength;
  if (ArrayBuffer.isView(value)) return value.byteLength;
  return null;
};

const closeSocket = (socket: SocketLike, code: number, reason: string): void => {
  try {
    socket.close(code, reason);
  } catch {
    // 浏览器会对无效关闭状态抛错；桥接清理不应因此中断。
  }
};

const createPageWsController = ({ createSocket, emit, getCurrentPageUrl }: Dependencies): PageWsController => {
  const sockets = new Map<string, SocketLike>();

  const emitEvent = (connectionId: string, event: ProTrainV2PageEvent): void => {
    if (sockets.get(connectionId)) emit(event);
  };

  const attachSocketEvents = (socket: SocketLike, connectionId: string): void => {
    socket.addEventListener('open', () => {
      emitEvent(connectionId, {
        protocol: PROTOCOL,
        version: VERSION,
        direction: 'page-to-extension',
        connectionId,
        type: 'OPEN',
      });
    });
    socket.addEventListener('message', event => {
      if (!isRecord(event)) return;
      if (typeof event.data === 'string') {
        emitEvent(connectionId, {
          protocol: PROTOCOL,
          version: VERSION,
          direction: 'page-to-extension',
          connectionId,
          type: 'TEXT',
          payload: { data: event.data },
        });
        return;
      }
      const byteLength = getBinaryByteLength(event.data);
      if (byteLength !== null) {
        emitEvent(connectionId, {
          protocol: PROTOCOL,
          version: VERSION,
          direction: 'page-to-extension',
          connectionId,
          type: 'BINARY',
          payload: { byteLength },
        });
      }
    });
    socket.addEventListener('error', () => {
      emitEvent(connectionId, {
        protocol: PROTOCOL,
        version: VERSION,
        direction: 'page-to-extension',
        connectionId,
        type: 'ERROR',
      });
    });
    socket.addEventListener('close', event => {
      if (sockets.get(connectionId) !== socket) return;
      sockets.delete(connectionId);
      const close = isRecord(event) ? event : {};
      emit({
        protocol: PROTOCOL,
        version: VERSION,
        direction: 'page-to-extension',
        connectionId,
        type: 'CLOSE',
        payload: {
          code: typeof close.code === 'number' ? close.code : 1006,
          reason: typeof close.reason === 'string' ? close.reason : '',
          wasClean: close.wasClean === true,
        },
      });
    });
  };

  const handle = (command: ProTrainV2Command): void => {
    const existing = sockets.get(command.connectionId);
    if (command.type === 'CONNECT') {
      if (readTaskIdFromPageUrl(getCurrentPageUrl()) !== command.payload.taskId) return;
      if (existing) {
        sockets.delete(command.connectionId);
        closeSocket(existing, 1000, 'replaced');
      }
      try {
        const socket = createSocket(buildTrainV2Url(command.payload));
        socket.binaryType = 'arraybuffer';
        sockets.set(command.connectionId, socket);
        attachSocketEvents(socket, command.connectionId);
      } catch {
        emit({
          protocol: PROTOCOL,
          version: VERSION,
          direction: 'page-to-extension',
          connectionId: command.connectionId,
          type: 'ERROR',
        });
      }
      return;
    }
    if (!existing) return;
    if (command.type === 'SEND' && isAllowedTrainV2Payload(command.payload.data)) {
      try {
        existing.send(command.payload.data);
      } catch {
        // send 失败由同一 socket 的 error/close 生命周期通知扩展。
      }
      return;
    }
    if (command.type === 'CLOSE') {
      sockets.delete(command.connectionId);
      closeSocket(existing, command.payload.code, command.payload.reason);
    }
  };

  const dispose = (): void => {
    const activeSockets = [...sockets.values()];
    sockets.clear();
    for (const socket of activeSockets) closeSocket(socket, 1000, 'page bridge disposed');
  };

  return { handle, dispose };
};

export { createPageWsController };
export type { Dependencies, PageWsController, SocketLike };
