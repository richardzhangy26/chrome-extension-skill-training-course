import { registerContentPortRelay } from '@src/pro-train-v2/content-port-relay';
import type { PortConnectEvent, WindowLike } from '@src/pro-train-v2/content-port-relay';

const pageWindow: WindowLike = {
  location: window.location,
  addEventListener: (_type, listener) => window.addEventListener('message', listener),
  removeEventListener: (_type, listener) => window.removeEventListener('message', listener),
  postMessage: (message, targetOrigin) => window.postMessage(message, targetOrigin),
};

const portConnectEvent: PortConnectEvent = {
  addListener: listener => chrome.runtime.onConnect.addListener(listener as (port: chrome.runtime.Port) => void),
  removeListener: listener => chrome.runtime.onConnect.removeListener(listener as (port: chrome.runtime.Port) => void),
};

const stopRelay = registerContentPortRelay(pageWindow, portConnectEvent);

window.addEventListener('pagehide', stopRelay, { once: true });
