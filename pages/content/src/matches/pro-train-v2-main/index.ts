import { startPageWindowAdapter } from '@src/pro-train-v2/page-window-adapter';
import { createPageWsController } from '@src/pro-train-v2/page-ws-controller';
import type { WindowLike } from '@src/pro-train-v2/page-window-adapter';

const pageWindow: WindowLike = {
  location: window.location,
  addEventListener: (_type, listener) => window.addEventListener('message', listener),
  removeEventListener: (_type, listener) => window.removeEventListener('message', listener),
};

const controller = createPageWsController({
  createSocket: url => new WebSocket(url),
  emit: event => window.postMessage(event, window.location.origin),
  getCurrentPageUrl: () => window.location.href,
});
const stopAdapter = startPageWindowAdapter(pageWindow, controller);

window.addEventListener(
  'pagehide',
  () => {
    stopAdapter();
    controller.dispose();
  },
  { once: true },
);
