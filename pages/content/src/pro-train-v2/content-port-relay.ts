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
  addEventListener(type: 'message', listener: EventListener): void;
  removeEventListener(type: 'message', listener: EventListener): void;
  postMessage(message: ProTrainV2Command, targetOrigin: string): void;
}

const registerContentPortRelay = (windowRef: WindowLike, onConnect: PortConnectEvent): (() => void) => {
  const cleanups = new Map<PortLike, () => void>();

  const forwardCommand = (command: ProTrainV2Command): void => {
    windowRef.postMessage(command, windowRef.location.origin);
  };

  const onPortConnect = (port: PortLike): void => {
    if (port.name !== PRO_TRAIN_V2_PORT_NAME || cleanups.has(port)) return;
    const connectionIds = new Set<string>();

    const onPortMessage = (message: unknown): void => {
      if (!isProTrainV2Command(message)) return;
      if (message.type === 'CONNECT') connectionIds.add(message.connectionId);
      if (!connectionIds.has(message.connectionId)) return;
      forwardCommand(message);
      if (message.type === 'CLOSE') connectionIds.delete(message.connectionId);
    };
    const onWindowMessage = (event: Event): void => {
      const messageEvent = event as MessageEvent<unknown>;
      if (messageEvent.source !== windowRef || messageEvent.origin !== windowRef.location.origin) return;
      if (!isProTrainV2PageEvent(messageEvent.data) || !connectionIds.has(messageEvent.data.connectionId)) return;
      port.postMessage(messageEvent.data);
    };
    const cleanup = (): void => {
      windowRef.removeEventListener('message', onWindowMessage);
      port.onMessage.removeListener(onPortMessage);
      port.onDisconnect.removeListener(onPortDisconnect);
      cleanups.delete(port);
    };
    const onPortDisconnect = (): void => {
      for (const connectionId of connectionIds) {
        forwardCommand({
          protocol: PROTOCOL,
          version: VERSION,
          direction: 'extension-to-page',
          connectionId,
          type: 'CLOSE',
          payload: { code: 1000, reason: 'port disconnected' },
        });
      }
      connectionIds.clear();
      cleanup();
    };

    port.onMessage.addListener(onPortMessage);
    port.onDisconnect.addListener(onPortDisconnect);
    windowRef.addEventListener('message', onWindowMessage);
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
