import { isProTrainV2Command } from './protocol';
import type { PageWsController } from './page-ws-controller';

interface WindowLike {
  location: { origin: string };
  addEventListener(type: 'message', listener: EventListener): void;
  removeEventListener(type: 'message', listener: EventListener): void;
}

const startPageWindowAdapter = (windowRef: WindowLike, controller: PageWsController): (() => void) => {
  const onMessage = (event: Event): void => {
    const messageEvent = event as MessageEvent<unknown>;
    if (messageEvent.source !== windowRef || messageEvent.origin !== windowRef.location.origin) return;
    if (isProTrainV2Command(messageEvent.data)) controller.handle(messageEvent.data);
  };
  windowRef.addEventListener('message', onMessage);
  return () => windowRef.removeEventListener('message', onMessage);
};

export { startPageWindowAdapter };
export type { WindowLike };
