import { PROTOCOL, VERSION, PRO_TRAIN_V2_PORT_NAME, isProTrainV2Command, isProTrainV2PageEvent } from './protocol';
import type { ProTrainV2Command } from './protocol';

interface ListenerEvent<T> {
  addListener(listener: T): void;
  removeListener(listener: T): void;
}

interface PortLike {
  name: string;
  onMessage: ListenerEvent<(message: unknown) => void>;
  onDisconnect: ListenerEvent<() => void>;
  postMessage(message: unknown): void;
}

interface PortConnectEvent {
  addListener(listener: (port: PortLike) => void): void;
  removeListener(listener: (port: PortLike) => void): void;
}

interface WindowLike {
  location: { origin: string };
  messageSource: unknown;
  addEventListener(type: 'message', listener: EventListener): void;
  removeEventListener(type: 'message', listener: EventListener): void;
  postMessage(message: ProTrainV2Command, targetOrigin: string): void;
}

const registerContentPortRelay = (windowRef: WindowLike, onConnect: PortConnectEvent): (() => void) => {
  const cleanups = new Map<PortLike, () => void>();
  const owners = new Map<string, PortLike>();
  const connectionIdsByPort = new Map<PortLike, Set<string>>();

  const forwardCommand = (command: ProTrainV2Command): void => {
    windowRef.postMessage(command, windowRef.location.origin);
  };

  const onPortConnect = (port: PortLike): void => {
    if (port.name !== PRO_TRAIN_V2_PORT_NAME || cleanups.has(port)) return;
    const connectionIds = new Set<string>();

    const releaseOwnership = (connectionId: string): void => {
      if (owners.get(connectionId) !== port) return;
      owners.delete(connectionId);
      connectionIds.delete(connectionId);
    };

    const onPortMessage = (message: unknown): void => {
      if (!isProTrainV2Command(message)) return;
      if (message.type === 'CONNECT') {
        const previousOwner = owners.get(message.connectionId);
        if (previousOwner && previousOwner !== port) {
          connectionIdsByPort.get(previousOwner)?.delete(message.connectionId);
        }
        owners.set(message.connectionId, port);
        connectionIds.add(message.connectionId);
      }
      if (owners.get(message.connectionId) !== port) return;
      forwardCommand(message);
      if (message.type === 'CLOSE') releaseOwnership(message.connectionId);
    };
    const onWindowMessage = (event: Event): void => {
      const messageEvent = event as MessageEvent<unknown>;
      if (messageEvent.source !== windowRef.messageSource || messageEvent.origin !== windowRef.location.origin) return;
      if (!isProTrainV2PageEvent(messageEvent.data) || owners.get(messageEvent.data.connectionId) !== port) return;
      port.postMessage(messageEvent.data);
      if (messageEvent.data.type === 'CLOSE') releaseOwnership(messageEvent.data.connectionId);
    };
    const cleanup = (): void => {
      windowRef.removeEventListener('message', onWindowMessage);
      port.onMessage.removeListener(onPortMessage);
      port.onDisconnect.removeListener(onPortDisconnect);
      cleanups.delete(port);
      connectionIdsByPort.delete(port);
    };
    const onPortDisconnect = (): void => {
      for (const connectionId of [...connectionIds]) {
        if (owners.get(connectionId) !== port) continue;
        forwardCommand({
          protocol: PROTOCOL,
          version: VERSION,
          direction: 'extension-to-page',
          connectionId,
          type: 'CLOSE',
          payload: { code: 1000, reason: 'port disconnected' },
        });
        releaseOwnership(connectionId);
      }
      cleanup();
    };

    port.onMessage.addListener(onPortMessage);
    port.onDisconnect.addListener(onPortDisconnect);
    windowRef.addEventListener('message', onWindowMessage);
    connectionIdsByPort.set(port, connectionIds);
    cleanups.set(port, onPortDisconnect);
  };

  onConnect.addListener(onPortConnect);
  return () => {
    onConnect.removeListener(onPortConnect);
    for (const disconnect of [...cleanups.values()]) disconnect();
  };
};

export { registerContentPortRelay };
export type { PortConnectEvent, PortLike, WindowLike };
