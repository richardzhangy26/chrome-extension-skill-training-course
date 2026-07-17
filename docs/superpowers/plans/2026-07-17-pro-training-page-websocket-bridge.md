# 能力训练 Pro 页面源 WebSocket 中继 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让能力训练 Pro 的 trainV2 WebSocket 从 Polymas 教学页面主世界建立，修复扩展 Origin 导致的握手期 `1006`，同时修复连接阶段日志和账号/任务切换缓存。

**Architecture:** 两个静态 content script entry 分别运行在 `MAIN` 与 `ISOLATED` world：MAIN 持有固定 trainV2 WebSocket，ISOLATED 用 `window.postMessage` 与 Side Panel 的 `chrome.tabs.connect` Port 做受限中继。`TrainV2Client` 继续拥有协议、心跳和事件分发，只替换底层 socket；Background 只返回经过域名校验的活动标签信息，不中继长连接数据。

**Tech Stack:** Chrome Extension Manifest V3、TypeScript、Vite IIFE content scripts、Chrome `runtime.Port` / `tabs.connect`、浏览器 WebSocket、Node 22 `node:test`、pnpm/Turborepo。

## Global Constraints

- WebSocket 地址固定为 `wss://cloudapi.polymas.com/ai-platform/ws/trainV2`，不能接受任意 URL。
- content script 只匹配 `https://hike-teaching-center.polymas.com/*`、只进顶层 frame、`run_at: document_start`。
- 只允许 `scriptStart`、`stepStart`、`userTextInput`、`continueCurrentStep`、`heartBeat` 五种出站事件及其既定 payload。
- 不新增 `scripting`、DNR、`webRequest`、`web_accessible_resources` 或额外 host permission。
- 不传输 Cookie、Authorization、Admin Web token、LLM 密钥、聊天历史或二进制音频；二进制帧只转成活动事件。
- 不保留 Side Panel 直接 `new WebSocket()` 的兜底，不修改普通文字/口语训练和现有 Pro UI/状态机行为。
- 业务 hook 不直接调用 `chrome.*`；活动标签查询与 `tabs.connect` 封装在 `background-bridge.ts`。
- 每个生产行为先写测试并运行到预期失败，再写最小实现；测试使用 `node --import tsx --test`，不引入 Vitest/jsdom。
- 不修改或提交用户现有未跟踪文件 `.playwright-mcp/`、`.qoder/`、`docs/ability-training-pro-api.md`。

---

## File Structure

- `pages/content/src/pro-train-v2/protocol.ts`：MAIN/ISOLATED 共用的 envelope 类型、type guards、固定 URL 与出站事件校验。
- `pages/content/src/pro-train-v2/page-ws-controller.ts`：无 Window/Chrome 依赖的 WebSocket 生命周期控制器。
- `pages/content/src/pro-train-v2/page-window-adapter.ts`：MAIN world 的 Window 消息适配。
- `pages/content/src/pro-train-v2/content-port-relay.ts`：ISOLATED world 的 Port ↔ Window 中继。
- `pages/content/src/matches/pro-train-v2-main/index.ts`：MAIN entry，只装配真实 `window/WebSocket`。
- `pages/content/src/matches/pro-train-v2-relay/index.ts`：ISOLATED entry，只注册 `chrome.runtime.onConnect`。
- `pages/side-panel/src/services/ws/train-v2-page-relay.ts`：把页面 Port 适配成 `TrainV2Client` 所需的 socket 接口。
- `pages/side-panel/src/services/ws/train-v2-client.ts`：保留协议职责，使用页面 relay socket 并修正 phase。
- `chrome-extension/src/background/index.ts` 与 `pages/side-panel/src/services/background-bridge.ts`：返回/连接经过校验的活动 Polymas 标签。
- `pages/side-panel/src/services/polymas-user-service.ts`、`pages/side-panel/src/hooks/useProAgentChat.ts`、`pages/side-panel/src/hooks/useAgentChat.ts`：刷新用户缓存与兼容两种 task ID 参数。

---

### Task 1: 页面主世界 WebSocket host 与隔离世界中继

**Files:**
- Create: `pages/content/src/pro-train-v2/protocol.ts`
- Create: `pages/content/src/pro-train-v2/protocol.test.mjs`
- Create: `pages/content/src/pro-train-v2/page-ws-controller.ts`
- Create: `pages/content/src/pro-train-v2/page-ws-controller.test.mjs`
- Create: `pages/content/src/pro-train-v2/page-window-adapter.ts`
- Create: `pages/content/src/pro-train-v2/page-window-adapter.test.mjs`
- Create: `pages/content/src/pro-train-v2/content-port-relay.ts`
- Create: `pages/content/src/pro-train-v2/content-port-relay.test.mjs`
- Create: `pages/content/src/matches/pro-train-v2-main/index.ts`
- Create: `pages/content/src/matches/pro-train-v2-relay/index.ts`
- Modify: `chrome-extension/manifest.ts`
- Create: `chrome-extension/src/pro-train-v2-content-scripts.test.mjs`

**Interfaces:**
- Produces: `ProTrainV2Command`, `ProTrainV2PageEvent`, `isProTrainV2Command`, `isProTrainV2PageEvent`, `buildTrainV2Url`, `readTaskIdFromPageUrl`, `isAllowedTrainV2Payload`.
- Produces: `createPageWsController({ createSocket, emit, getCurrentPageUrl })` with `handle(command)` and `dispose()`; URL is read at CONNECT time so SPA navigation is supported.
- Produces: `startPageWindowAdapter(windowRef: WindowLike, controller: PageWsController): () => void` and `registerContentPortRelay(windowRef: WindowLike, onConnect: PortConnectEvent): () => void`.
- Consumes: only Web platform/Chrome Port boundaries injected through narrow interfaces.

- [ ] **Step 1: Write protocol failing tests**

```js
test('CONNECT 只接受当前页面的 Pro taskId 与三个非空标识', () => {
  assert.equal(isProTrainV2Command(command('CONNECT', { taskId: 'PRO123', userId: 'u1', sessionId: 's1' })), true);
  assert.equal(isProTrainV2Command(command('CONNECT', { taskId: 'BAD', userId: 'u1', sessionId: 's1' })), false);
});

test('SEND 只接受五种既定事件和合法 payload', () => {
  assert.equal(isAllowedTrainV2Payload('{"event":"stepStart","payload":{"stepId":"s1"}}'), true);
  assert.equal(isAllowedTrainV2Payload('{"event":"unknown"}'), false);
});

test('URL 只能由固定 base 和三个参数构造', () => {
  assert.equal(
    buildTrainV2Url({ taskId: 'PRO123', userId: 'u1', sessionId: 's1' }),
    'wss://cloudapi.polymas.com/ai-platform/ws/trainV2?taskId=PRO123&userId=u1&sessionId=s1',
  );
});
```

- [ ] **Step 2: Run protocol tests and verify RED**

Run: `node --import tsx --test pages/content/src/pro-train-v2/protocol.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `protocol.ts`.

- [ ] **Step 3: Implement the narrow protocol**

```ts
const PROTOCOL = 'polymas-pro-train-v2' as const;
const VERSION = 1 as const;
const PRO_TRAIN_V2_PORT_NAME = 'polymas-pro-train-v2' as const;
const TRAIN_V2_BASE = 'wss://cloudapi.polymas.com/ai-platform/ws/trainV2';

type Envelope<Direction extends string, Type extends string, Payload = undefined> = {
  protocol: typeof PROTOCOL;
  version: typeof VERSION;
  direction: Direction;
  connectionId: string;
  type: Type;
} & (Payload extends undefined ? { payload?: never } : { payload: Payload });

type ProTrainV2Command =
  | Envelope<'extension-to-page', 'CONNECT', { taskId: string; userId: string; sessionId: string }>
  | Envelope<'extension-to-page', 'SEND', { data: string }>
  | Envelope<'extension-to-page', 'CLOSE', { code: number; reason: string }>;

type ProTrainV2PageEvent =
  | Envelope<'page-to-extension', 'OPEN'>
  | Envelope<'page-to-extension', 'TEXT', { data: string }>
  | Envelope<'page-to-extension', 'BINARY', { byteLength: number }>
  | Envelope<'page-to-extension', 'ERROR'>
  | Envelope<'page-to-extension', 'CLOSE', { code: number; reason: string; wasClean: boolean }>;
```

Implement record/string/number guards, exact protocol/version/direction checks, connection ID length bounds, `PRO` task ID validation, payload validation for the five allowed events, and fixed URL construction. Export APIs at file end.

- [ ] **Step 4: Run protocol tests and verify GREEN**

Run: `node --import tsx --test pages/content/src/pro-train-v2/protocol.test.mjs`

Expected: all protocol tests PASS.

- [ ] **Step 5: Write controller/adapter/relay failing tests**

```js
test('controller 把 socket 生命周期映射为页面事件且二进制只上报长度', () => {
  const controller = createPageWsController({ createSocket, emit: events.push.bind(events), getCurrentPageUrl: () => currentPageUrl });
  controller.handle(connectCommand);
  socket.open();
  socket.message('hello');
  socket.message(new Uint8Array([1, 2, 3]).buffer);
  assert.deepEqual(events.map(x => x.type), ['OPEN', 'TEXT', 'BINARY']);
});

test('重复 connectionId 先关闭旧 socket，dispose 关闭全部 socket', () => {
  controller.handle(connectCommand);
  controller.handle(connectCommand);
  assert.equal(firstSocket.closeCalls.length, 1);
  controller.dispose();
  assert.equal(secondSocket.closeCalls.length, 1);
});

test('window adapter 只接受同 window、同 origin 的合法命令', () => {
  dispatch({ source: otherWindow, origin: HIKE_ORIGIN, data: connectCommand });
  dispatch({ source: fakeWindow, origin: 'https://evil.example', data: connectCommand });
  dispatch({ source: fakeWindow, origin: HIKE_ORIGIN, data: connectCommand });
  assert.equal(handled.length, 1);
});

test('Port 断开时 relay 给其全部 connectionId 发 CLOSE 并清 listener', () => {
  relay.accept(port);
  port.emitMessage(connectCommand);
  port.emitDisconnect();
  assert.equal(posted.at(-1).type, 'CLOSE');
  assert.equal(windowListenerCount(), 0);
});
```

- [ ] **Step 6: Run controller/adapter/relay tests and verify RED**

Run: `node --import tsx --test pages/content/src/pro-train-v2/page-ws-controller.test.mjs pages/content/src/pro-train-v2/page-window-adapter.test.mjs pages/content/src/pro-train-v2/content-port-relay.test.mjs`

Expected: FAIL because the three production modules do not exist.

- [ ] **Step 7: Implement controller, Window adapter and Port relay**

```ts
interface SocketLike {
  binaryType: BinaryType;
  close(code?: number, reason?: string): void;
  send(data: string): void;
  addEventListener(type: 'open' | 'message' | 'error' | 'close', listener: (event: unknown) => void): void;
}

const createPageWsController = ({ createSocket, emit, getCurrentPageUrl }: Dependencies) => {
  const sockets = new Map<string, SocketLike>();
  const handle = (command: ProTrainV2Command) => {
    const existing = sockets.get(command.connectionId);
    if (command.type === 'CONNECT') {
      if (readTaskIdFromPageUrl(getCurrentPageUrl()) !== command.payload.taskId) return;
      existing?.close(1000, 'replaced');
      const socket = createSocket(buildTrainV2Url(command.payload));
      socket.binaryType = 'arraybuffer';
      sockets.set(command.connectionId, socket);
      attachSocketEvents(socket, command.connectionId, emit, () => sockets.delete(command.connectionId));
      return;
    }
    if (!existing) return;
    if (command.type === 'SEND' && isAllowedTrainV2Payload(command.payload.data)) {
      existing.send(command.payload.data);
      return;
    }
    if (command.type === 'CLOSE') {
      sockets.delete(command.connectionId);
      existing.close(command.payload.code, command.payload.reason);
    }
  };
  const dispose = () => {
    for (const socket of sockets.values()) socket.close(1000, 'page bridge disposed');
    sockets.clear();
  };
  return { handle, dispose };
};
```

The Window adapter must use exact `location.origin` as `postMessage` target and validate `source/origin`. The Port relay must accept only the fixed port name, keep a `Set` of connection IDs per Port, forward only validated messages, and synthesize CLOSE for every owned connection on disconnect.

- [ ] **Step 8: Run controller/adapter/relay tests and verify GREEN**

Run: `node --import tsx --test pages/content/src/pro-train-v2/*.test.mjs`

Expected: all page bridge tests PASS.

- [ ] **Step 9: Write manifest wiring failing test**

```js
test('manifest 静态注入 MAIN 与 ISOLATED 两个 bridge entry', async () => {
  const source = await readFile(new URL('../../../chrome-extension/manifest.ts', import.meta.url), 'utf8');
  assert.match(source, /content\/pro-train-v2-main\.iife\.js/);
  assert.match(source, /content\/pro-train-v2-relay\.iife\.js/);
  assert.match(source, /world:\s*'MAIN'/);
  assert.match(source, /world:\s*'ISOLATED'/);
  assert.doesNotMatch(source, /'scripting'/);
});
```

- [ ] **Step 10: Run manifest wiring test and verify RED**

Run: `node --test chrome-extension/src/pro-train-v2-content-scripts.test.mjs`

Expected: FAIL because manifest has no Pro bridge content scripts.

- [ ] **Step 11: Add entries and manifest declarations**

```ts
content_scripts: [
  {
    matches: ['https://hike-teaching-center.polymas.com/*'],
    js: ['content/pro-train-v2-main.iife.js'],
    run_at: 'document_start',
    world: 'MAIN',
  },
  {
    matches: ['https://hike-teaching-center.polymas.com/*'],
    js: ['content/pro-train-v2-relay.iife.js'],
    run_at: 'document_start',
    world: 'ISOLATED',
  },
],
```

MAIN entry instantiates the controller with `new WebSocket(url)` and starts the Window adapter. ISOLATED entry registers `chrome.runtime.onConnect` with `registerContentPortRelay`.

- [ ] **Step 12: Run Task 1 verification**

Run:

```bash
node --import tsx --test pages/content/src/pro-train-v2/*.test.mjs
node --test chrome-extension/src/pro-train-v2-content-scripts.test.mjs
pnpm -F @extension/content-script lint
pnpm -F @extension/content-script type-check
```

Expected: all tests PASS; lint/type-check exit 0.

- [ ] **Step 13: Commit Task 1**

```bash
git add chrome-extension/manifest.ts chrome-extension/src/pro-train-v2-content-scripts.test.mjs pages/content/src/pro-train-v2 pages/content/src/matches/pro-train-v2-main pages/content/src/matches/pro-train-v2-relay
git commit -m "feat(content): bridge pro training websocket through page origin"
```

---

### Task 2: Side Panel 页面 relay socket 与 TrainV2Client 集成

**Files:**
- Modify: `chrome-extension/src/background/index.ts`
- Create: `chrome-extension/src/background/current-training-tab.ts`
- Create: `chrome-extension/src/background/current-training-tab.test.mjs`
- Modify: `pages/side-panel/src/services/background-bridge.ts`
- Create: `pages/side-panel/src/services/ws/train-v2-page-relay.ts`
- Create: `pages/side-panel/src/services/ws/train-v2-page-relay.test.mjs`
- Modify: `pages/side-panel/src/services/ws/train-v2-client.ts`
- Modify: `pages/side-panel/src/services/ws/train-v2-client.test.mjs`

**Interfaces:**
- Consumes: Task 1 Port name and command/page event wire format.
- Produces: `CurrentTabInfo { id: number; url: string }`, `getCurrentTabInfo()`, `connectProTrainV2Page()`.
- Produces: `TrainV2Socket`, `TrainV2SocketFactory`, `createTrainV2PageRelaySocket(params)`.
- Produces: serializable `TrainV2CloseInfo { code: number; reason: string; wasClean: boolean }`; `TrainV2Handlers.onClose` consumes this instead of requiring a DOM `CloseEvent` instance.
- `TrainV2Client` constructor gains optional `socketFactory` only for dependency injection; default is the page relay factory.

- [ ] **Step 1: Write current-tab failing tests**

```js
test('只接受精确 HTTPS teaching-center hostname', () => {
  assert.equal(toCurrentTrainingTab({ id: 1, url: 'https://hike-teaching-center.polymas.com/x' })?.id, 1);
  assert.equal(toCurrentTrainingTab({ id: 1, url: 'https://hike-teaching-center.polymas.com.evil/x' }), null);
  assert.equal(toCurrentTrainingTab({ id: 1, url: 'http://hike-teaching-center.polymas.com/x' }), null);
});
```

- [ ] **Step 2: Run current-tab tests and verify RED**

Run: `node --import tsx --test chrome-extension/src/background/current-training-tab.test.mjs`

Expected: FAIL with missing `current-training-tab.ts`.

- [ ] **Step 3: Implement GET_CURRENT_TAB_INFO and bridge Port factory**

```ts
interface CurrentTabInfo { id: number; url: string }

const toCurrentTrainingTab = (tab: Pick<chrome.tabs.Tab, 'id' | 'url'>): CurrentTabInfo | null => {
  if (typeof tab.id !== 'number' || !tab.url) return null;
  const url = new URL(tab.url);
  return url.protocol === 'https:' && url.hostname === 'hike-teaching-center.polymas.com'
    ? { id: tab.id, url: url.toString() }
    : null;
};
```

Add `GET_CURRENT_TAB_INFO` to Background message union/switch. In `background-bridge.ts`, add:

```ts
const connectProTrainV2Page = async (): Promise<chrome.runtime.Port> => {
  const response = await sendMessage<CurrentTabInfo>('GET_CURRENT_TAB_INFO');
  if (!response.success || !response.data) throw new Error(response.error || '请打开能力训练 Pro 页面');
  return chrome.tabs.connect(response.data.id, { name: 'polymas-pro-train-v2', frameId: 0 });
};
```

- [ ] **Step 4: Write page relay and client lifecycle failing tests**

```js
test('relay OPEN 后 readyState=OPEN，SEND/CLOSE 通过同一 connectionId', async () => {
  const socket = createTrainV2PageRelaySocket(params, { connectPort: async () => port, connectionId: () => 'cid' });
  port.emitMessage(pageEvent('OPEN', 'cid'));
  socket.send('{"event":"scriptStart"}');
  socket.close(1000, 'done');
  assert.deepEqual(port.messages.map(x => x.type), ['CONNECT', 'SEND', 'CLOSE']);
});

test('Port 在 OPEN 前断开，报告桥接断开且保持 handshake phase', async () => {
  const client = new TrainV2Client(params, handlers, fakeSocketFactory);
  const pending = client.connect();
  fakeSocket.emitError();
  fakeSocket.emitClose({ code: 1006, reason: '', wasClean: false });
  await assert.rejects(pending, /连接失败/);
  assert.deepEqual(phases, ['handshake', 'handshake']);
});

test('OPEN 后只发送一次 scriptStart 并进入 connected phase', async () => {
  const pending = client.connect();
  fakeSocket.emitOpen();
  await pending;
  assert.deepEqual(fakeSocket.sent, ['{"event":"scriptStart"}']);
  fakeSocket.emitClose({ code: 1006, reason: '', wasClean: false });
  assert.equal(closePhase, 'connected');
});
```

- [ ] **Step 5: Run page relay/client tests and verify RED**

Run: `node --import tsx --test pages/side-panel/src/services/ws/train-v2-page-relay.test.mjs pages/side-panel/src/services/ws/train-v2-client.test.mjs`

Expected: relay module missing and phase regression test fails because close is incorrectly logged as connected.

- [ ] **Step 6: Implement page relay socket and inject it into TrainV2Client**

```ts
interface TrainV2Socket {
  binaryType: BinaryType;
  readonly readyState: number;
  addEventListener(type: 'open' | 'message' | 'error' | 'close', listener: (event: unknown) => void): void;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

type TrainV2SocketFactory = (params: TrainV2ConnectionParams) => TrainV2Socket;
```

The relay socket asynchronously opens the active-tab Port, sends `CONNECT`, ignores wrong connection IDs, maps `TEXT` to string messages and `BINARY` to a zero-length ArrayBuffer activity frame, and turns Port disconnect into an actionable error/close. `close()` is idempotent and disconnects the Port after sending CLOSE.

In `TrainV2Client`, store independent booleans:

```ts
let settled = false;
let opened = false;
const phase = () => (opened ? 'connected' : 'handshake');
```

Set `opened = true` only in the socket open listener. Use the injected/default socket factory instead of `new WebSocket`, and compare `readyState` against the exported socket OPEN constant.

- [ ] **Step 7: Run Task 2 tests and verification**

Run:

```bash
node --import tsx --test chrome-extension/src/background/current-training-tab.test.mjs
node --import tsx --test pages/side-panel/src/services/ws/train-v2-page-relay.test.mjs pages/side-panel/src/services/ws/train-v2-client.test.mjs
pnpm -F chrome-extension lint
pnpm -F chrome-extension type-check
pnpm -F @extension/sidepanel lint
pnpm -F @extension/sidepanel type-check
```

Expected: all tests PASS; lint/type-check exit 0.

- [ ] **Step 8: Commit Task 2**

```bash
git add chrome-extension/src/background pages/side-panel/src/services/background-bridge.ts pages/side-panel/src/services/ws/train-v2-page-relay.ts pages/side-panel/src/services/ws/train-v2-page-relay.test.mjs pages/side-panel/src/services/ws/train-v2-client.ts pages/side-panel/src/services/ws/train-v2-client.test.mjs
git commit -m "fix(side-panel): connect pro websocket through training page"
```

---

### Task 3: 账号刷新与 taskId 页面切换

**Files:**
- Modify: `pages/side-panel/src/services/polymas-user-service.ts`
- Create: `pages/side-panel/src/services/polymas-user-service.test.mjs`
- Modify: `pages/side-panel/src/hooks/useProAgentChat.ts`
- Create: `pages/side-panel/src/hooks/useProAgentChat.user-refresh.test.mjs`
- Modify: `pages/side-panel/src/hooks/useAgentChat.ts`
- Create: `pages/side-panel/src/hooks/useAgentChat.task-url.test.mjs`

**Interfaces:**
- Produces: `createPolymasUserInfoLoader(fetcher)` with `fetch() / refresh() / invalidate()`; module-level wrappers expose `refreshPolymasUserInfo(): Promise<PolymasUserInfo>` while retaining cached `fetchPolymasUserInfo()` and `invalidatePolymasUserInfo()`.
- Consumes: existing `extractTrainTaskId(url)` which already understands both `trainTaskId` and `taskId`.

- [ ] **Step 1: Write user refresh failing tests**

```js
test('普通 fetch 复用 cache，refresh 强制读取新账号', async () => {
  responses.push(userResponse('account-a'), userResponse('account-b'));
  const loader = createPolymasUserInfoLoader(fetcher);
  assert.equal((await loader.fetch()).userId, 'account-a');
  assert.equal((await loader.fetch()).userId, 'account-a');
  assert.equal((await loader.refresh()).userId, 'account-b');
  assert.equal(requestCount, 2);
});

test('旧请求失败不会清除更新后的新账号 promise', async () => {
  const loader = createPolymasUserInfoLoader(fetcher);
  const old = loader.fetch();
  const fresh = loader.refresh();
  rejectOld();
  resolveFresh(userResponse('account-b'));
  await assert.rejects(old);
  assert.equal((await fresh).userId, 'account-b');
  assert.equal((await loader.fetch()).userId, 'account-b');
});
```

- [ ] **Step 2: Run user refresh tests and verify RED**

Run: `node --import tsx --test pages/side-panel/src/services/polymas-user-service.test.mjs`

Expected: FAIL because `refreshPolymasUserInfo` does not exist.

- [ ] **Step 3: Implement generation-safe user cache refresh**

```ts
const createPolymasUserInfoLoader = (fetcher: () => Promise<PolymasUserInfo>) => {
  let cachedPromise: Promise<PolymasUserInfo> | null = null;
  const startFetch = () => {
    const request = fetcher();
    cachedPromise = request;
    void request.catch(() => {
      if (cachedPromise === request) cachedPromise = null;
    });
    return request;
  };
  return {
    fetch: () => cachedPromise ?? startFetch(),
    refresh: () => {
      cachedPromise = null;
      return startFetch();
    },
    invalidate: () => {
      cachedPromise = null;
    },
  };
};

const userInfoLoader = createPolymasUserInfoLoader(doFetch);
```

- [ ] **Step 4: Write hook wiring failing tests**

```js
test('Pro start 强制刷新用户，失败路径 invalidate', async () => {
  const source = await readFile(new URL('./useProAgentChat.ts', import.meta.url), 'utf8');
  assert.match(source, /refreshPolymasUserInfo\(\)/);
  assert.match(source, /invalidatePolymasUserInfo\(\)/);
});

test('URL 监听不再只接受 trainTaskId 字面量', async () => {
  const source = await readFile(new URL('./useAgentChat.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /url\.includes\('trainTaskId='\)/);
  assert.match(source, /extractTrainTaskId\(url\)/);
});
```

- [ ] **Step 5: Run hook wiring tests and verify RED**

Run: `node --test pages/side-panel/src/hooks/useProAgentChat.user-refresh.test.mjs pages/side-panel/src/hooks/useAgentChat.task-url.test.mjs`

Expected: FAIL because Pro uses cached fetch and the URL listener still gates on `trainTaskId=`.

- [ ] **Step 6: Wire refresh/invalidate and both task ID parameters**

Replace the Pro start call with `refreshPolymasUserInfo()`. In the run catch/failure path call `invalidatePolymasUserInfo()` before reporting failure. In `useAgentChat` URL listener, always call `extractTrainTaskId(url)` and only switch when it returns a non-null ID different from the current ID; pages without either parameter remain unchanged.

- [ ] **Step 7: Run Task 3 verification**

Run:

```bash
node --import tsx --test pages/side-panel/src/services/polymas-user-service.test.mjs
node --test pages/side-panel/src/hooks/useProAgentChat.user-refresh.test.mjs pages/side-panel/src/hooks/useAgentChat.task-url.test.mjs
pnpm -F @extension/sidepanel lint
pnpm -F @extension/sidepanel type-check
```

Expected: all tests PASS; lint/type-check exit 0.

- [ ] **Step 8: Commit Task 3**

```bash
git add pages/side-panel/src/services/polymas-user-service.ts pages/side-panel/src/services/polymas-user-service.test.mjs pages/side-panel/src/hooks/useProAgentChat.ts pages/side-panel/src/hooks/useProAgentChat.user-refresh.test.mjs pages/side-panel/src/hooks/useAgentChat.ts pages/side-panel/src/hooks/useAgentChat.task-url.test.mjs
git commit -m "fix(side-panel): refresh pro identity and task routing"
```

---

### Task 4: 全量验证与 yichi Chrome 回归

**Files:**
- Verify only: all files from Tasks 1-3
- Modify only if verification exposes a tested defect; add a failing regression test before any fix.

**Interfaces:**
- Consumes: completed page bridge, relay socket, refreshed user/task lifecycle.
- Produces: production `dist/` build for manual unpacked-extension reload; do not commit `dist/`.

- [ ] **Step 1: Run all focused tests**

```bash
node --import tsx --test pages/content/src/pro-train-v2/*.test.mjs
node --import tsx --test chrome-extension/src/background/current-training-tab.test.mjs
node --test chrome-extension/src/pro-train-v2-content-scripts.test.mjs
node --import tsx --test pages/side-panel/src/services/ws/train-v2-page-relay.test.mjs pages/side-panel/src/services/ws/train-v2-client.test.mjs pages/side-panel/src/services/polymas-user-service.test.mjs
node --test pages/side-panel/src/hooks/useProAgentChat.user-refresh.test.mjs pages/side-panel/src/hooks/useAgentChat.task-url.test.mjs
```

Expected: all tests PASS with zero failures.

- [ ] **Step 2: Run scoped lint/type-check**

```bash
pnpm -F @extension/content-script lint
pnpm -F @extension/content-script type-check
pnpm -F chrome-extension lint
pnpm -F chrome-extension type-check
pnpm -F @extension/sidepanel lint
pnpm -F @extension/sidepanel type-check
```

Expected: every command exits 0.

- [ ] **Step 3: Run production build and inspect generated manifest**

Run: `pnpm build`

Expected: exit 0 and `dist/manifest.json` contains both Pro content script entries with MAIN/ISOLATED worlds, no `scripting` permission.

- [ ] **Step 4: Reload extension and refresh the yichi Pro page**

In yichi Chrome, reload the unpacked extension from this worktree's `dist/`, then refresh
`https://hike-teaching-center.polymas.com/tch-hike/agent-course-full/5OD4zRqwwQirW3NKbdmP/ability-training-pro/create?trainTaskId=PROuNODZ41RAJttrEuzs&libraryId=tOHk1ZsadJ` once so static content scripts are injected.

- [ ] **Step 5: Verify the original symptom and protocol progression**

Start Pro mode from the plugin and confirm:

- Network trainV2 handshake status is `101`.
- Request Origin is `https://hike-teaching-center.polymas.com`.
- Frames show `scriptStart`, then `connected` and `nextStep`.
- At least one student turn can be sent and advanced.
- Stop closes the socket; restarting works without duplicate events.
- Refreshing/closing the teaching page gives an actionable bridge-disconnected message.

- [ ] **Step 6: Run final diff checks**

```bash
git diff --check
git status --short
git log --oneline -6
```

Expected: no whitespace errors; only the three planned implementation commits plus existing user-owned untracked files; no `dist/` changes staged.
