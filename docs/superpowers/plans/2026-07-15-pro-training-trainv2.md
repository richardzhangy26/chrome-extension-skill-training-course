# 能力训练 Pro（trainV2）集成实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在侧边栏「能力训练 Pro」模式实现 trainV2 多角色 WebSocket 训练流程（半交互 + 可切全自动），协议逻辑移植自已验证的 `auto_train_pro.py`。

**Architecture:** 独立 Pro 链路：新传输层 `TrainV2Client` + 新状态机 hook `useProAgentChat`，SidePanel 增加 `pro` 内容分支。AI 学生作答复用 `generateStudentAnswer`，空闲态复用 `IdleTrainingPanel`，日志写入 `agentLogStorage`。不侵入任何现有训练 hook。

**Tech Stack:** TypeScript + React（Chrome MV3 侧边栏页）、浏览器原生 WebSocket、`node:test`（`--experimental-strip-types` 直接导入 `.ts` 纯模块）。

**Spec:** `docs/superpowers/specs/2026-07-15-pro-training-trainv2-design.md`

## Global Constraints

- 所有命令在仓库根目录执行；根工作区为 Node >= 22.15.1、pnpm@10.11.0。
- ESLint 严格规则：只用箭头函数表达式；`export` 统一放文件末尾；未使用的 catch 变量写 `catch {}`；2 空格缩进。
- 不新增任何 npm 依赖；不新增存储 schema 字段；不修改 `useAgentChat.ts`、`useVoiceAgentChat.ts`、`useMultiRoleRun.ts`、`training-ws-client.ts`、`llm-service.ts`。
- 协议常量为脚本实测值，定义为命名常量、不做用户可配置项：心跳 30s、握手超时 10s、阶段开场文本「好的」、安静判定 2.5s、启动等待 60s、重试上限 12 次、全自动上限 40 轮。
- 消息气泡沿用现有渐变、不对称圆角与动画，不改既有视觉。
- 本仓有并行会话在同一 worktree 工作：每个任务开始前先 `git log --oneline -3` 与 `git status` 确认基线，遇到非预期改动先停下同步。
- 参考实现（只读，不复制进仓库）：`/Users/zhangyichi/github/chrome-extension-skill-training-course/auto_train_pro.py`。

## 文件结构

| 文件 | 操作 | 职责 |
| --- | --- | --- |
| `pages/side-panel/src/services/pro-conversation.ts` | 新建 | 纯函数：多角色轮次 → `generateStudentAnswer` 输入 / 日志字段映射 |
| `pages/side-panel/src/services/pro-conversation.test.mjs` | 新建 | 上述模块的 `node:test` 行为测试 |
| `pages/side-panel/src/services/ws/train-v2-client.ts` | 新建 | trainV2 WS 传输层：连接/心跳/事件分发/音频帧丢弃与活动计数 |
| `pages/side-panel/src/services/ws/train-v2-client.test.mjs` | 新建 | 事件分发纯函数与协议常量的行为测试 |
| `pages/side-panel/src/hooks/useProAgentChat.ts` | 新建 | Pro 状态机：连接生命周期、回合规则、阶段开场应答、AI 作答、日志 |
| `pages/side-panel/src/SidePanel.tsx` | 修改 | MessageBubble 角色标签、ChatInput 可选 props、`ProChatArea` 与 pro 分支接线 |

---

### Task 1: Pro 对话映射纯模块

**Files:**
- Create: `pages/side-panel/src/services/pro-conversation.ts`
- Test: `pages/side-panel/src/services/pro-conversation.test.mjs`

**Interfaces:**
- Consumes: 无（零依赖纯模块）。
- Produces（Task 3 依赖）:
  - `type ProTurnRole = 'user' | 'bot' | 'coach'`
  - `interface ProTurn { role: ProTurnRole; label: string; content: string }`
  - `buildStudentAnswerInput(turns: ProTurn[]): { aiQuestion: string; history: Array<{ ai: string; student: string }> }`
  - `formatProLogEntry(turn: ProTurn): { userText?: string; aiText?: string }`
  - `EMPTY_AI_PLACEHOLDER: string`

- [ ] **Step 1: 写失败测试**

创建 `pages/side-panel/src/services/pro-conversation.test.mjs`：

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildStudentAnswerInput, formatProLogEntry, EMPTY_AI_PLACEHOLDER } from './pro-conversation.ts';

test('buildStudentAnswerInput: 对方发言聚合为 aiQuestion，既往回合成对进 history', () => {
  const { aiQuestion, history } = buildStudentAnswerInput([
    { role: 'bot', label: '客户', content: '你好，我想咨询产品' },
    { role: 'user', label: '你(学生)', content: '好的，请讲' },
    { role: 'bot', label: '客户', content: '有什么推荐？' },
    { role: 'coach', label: '教练点评', content: '回应可以更主动' },
  ]);
  assert.deepEqual(history, [{ ai: '客户: 你好，我想咨询产品', student: '好的，请讲' }]);
  assert.equal(aiQuestion, '客户: 有什么推荐？\n[教练点评] 回应可以更主动');
});

test('buildStudentAnswerInput: 学生先发言（如阶段开场应答）时 ai 侧用占位符', () => {
  const { aiQuestion, history } = buildStudentAnswerInput([{ role: 'user', label: '你(学生)', content: '好的' }]);
  assert.deepEqual(history, [{ ai: EMPTY_AI_PLACEHOLDER, student: '好的' }]);
  assert.equal(aiQuestion, '');
});

test('buildStudentAnswerInput: 连续多条对方发言按换行拼接', () => {
  const { history } = buildStudentAnswerInput([
    { role: 'bot', label: '客户', content: '第一句' },
    { role: 'coach', label: '教练点评', content: '注意语气' },
    { role: 'user', label: '你(学生)', content: '收到' },
  ]);
  assert.deepEqual(history, [{ ai: '客户: 第一句\n[教练点评] 注意语气', student: '收到' }]);
});

test('formatProLogEntry: user→userText，bot/coach→aiText（带标签）', () => {
  assert.deepEqual(formatProLogEntry({ role: 'user', label: '你(学生)', content: '你好' }), { userText: '你好' });
  assert.deepEqual(formatProLogEntry({ role: 'bot', label: '客户', content: '在吗' }), { aiText: '客户: 在吗' });
  assert.deepEqual(formatProLogEntry({ role: 'coach', label: '教练点评', content: '不错' }), { aiText: '[教练点评] 不错' });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --experimental-strip-types --test pages/side-panel/src/services/pro-conversation.test.mjs`
Expected: FAIL（`Cannot find module ... pro-conversation.ts`）。

- [ ] **Step 3: 实现模块**

创建 `pages/side-panel/src/services/pro-conversation.ts`：

```typescript
/**
 * 能力训练 Pro 对话映射（纯函数）
 * 把 trainV2 多角色轮次序列映射为 generateStudentAnswer 输入与 agent-log-storage 日志字段。
 */

type ProTurnRole = 'user' | 'bot' | 'coach';

interface ProTurn {
  /** user=学生本人；bot=剧本角色；coach=主理人教练点评（roleNid === 'system'） */
  role: ProTurnRole;
  /** bot 为角色昵称；user 固定「你(学生)」；coach 固定「教练点评」 */
  label: string;
  content: string;
}

/** 学生发言之前没有任何对方发言时（如阶段开场应答）的 ai 侧占位 */
const EMPTY_AI_PLACEHOLDER = '（阶段开始）';

const formatOpponentLine = (turn: ProTurn): string =>
  turn.role === 'coach' ? `[教练点评] ${turn.content}` : `${turn.label}: ${turn.content}`;

/**
 * history：每个学生发言与其之前累计的非学生发言拼接配对（对齐 generateStudentAnswer 的 {ai, student} 格式）；
 * aiQuestion：最后一个学生发言之后的非学生发言拼接（当前待回应内容）。
 */
const buildStudentAnswerInput = (
  turns: ProTurn[],
): { aiQuestion: string; history: Array<{ ai: string; student: string }> } => {
  const history: Array<{ ai: string; student: string }> = [];
  let pendingOpponentLines: string[] = [];
  for (const turn of turns) {
    if (turn.role === 'user') {
      history.push({
        ai: pendingOpponentLines.length > 0 ? pendingOpponentLines.join('\n') : EMPTY_AI_PLACEHOLDER,
        student: turn.content,
      });
      pendingOpponentLines = [];
    } else {
      pendingOpponentLines.push(formatOpponentLine(turn));
    }
  }
  return { aiQuestion: pendingOpponentLines.join('\n'), history };
};

/** 映射为 ChatLogEntry 的 userText / aiText 字段（bot 发言带角色名，教练点评带 [教练点评] 标记） */
const formatProLogEntry = (turn: ProTurn): { userText?: string; aiText?: string } =>
  turn.role === 'user' ? { userText: turn.content } : { aiText: formatOpponentLine(turn) };

export { buildStudentAnswerInput, formatProLogEntry, EMPTY_AI_PLACEHOLDER };
export type { ProTurn, ProTurnRole };
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --experimental-strip-types --test pages/side-panel/src/services/pro-conversation.test.mjs`
Expected: `pass 4`、`fail 0`。

- [ ] **Step 5: lint 与类型检查**

Run: `pnpm -F @extension/sidepanel lint && pnpm -F @extension/sidepanel type-check`
Expected: 均无错误（`.mjs` 不在 ESLint 范围内，`.ts` 需通过）。

- [ ] **Step 6: Commit**

```bash
git add pages/side-panel/src/services/pro-conversation.ts pages/side-panel/src/services/pro-conversation.test.mjs
git commit -m "feat(side-panel): add pro conversation mapping helpers"
```

---

### Task 2: trainV2 WebSocket 客户端

**Files:**
- Create: `pages/side-panel/src/services/ws/train-v2-client.ts`
- Test: `pages/side-panel/src/services/ws/train-v2-client.test.mjs`

**Interfaces:**
- Consumes: 浏览器原生 `WebSocket`（结构对齐同目录 `training-ws-client.ts`）。
- Produces（Task 3 依赖）:
  - `class TrainV2Client`：
    - `constructor(params: { taskId: string; userId: string; sessionId: string }, handlers: TrainV2Handlers)`
    - `connect(): Promise<void>`（连接成功后自动发送 `scriptStart`）
    - `sendEvent(event: string, payload?: Record<string, unknown>): void`
    - `close(code?: number, reason?: string): void`
    - `get activitySeq(): number`（每收到一条事件或音频帧 +1）
    - `get readyState(): number`
  - `dispatchTrainV2Message(handlers: TrainV2Handlers, raw: string): boolean`（纯函数，供测试）
  - `interface TrainV2Handlers`（回调见下方代码）
  - payload 类型：`TrainV2NextStepPayload` / `TrainV2SelectRoleEndPayload` / `TrainV2BotAnswerEndPayload`
  - 常量：`TRAIN_V2_WS_BASE`、`HEARTBEAT_INTERVAL_MS`

- [ ] **Step 1: 写失败测试**

创建 `pages/side-panel/src/services/ws/train-v2-client.test.mjs`：

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { dispatchTrainV2Message, HEARTBEAT_INTERVAL_MS, TRAIN_V2_WS_BASE } from './train-v2-client.ts';

test('botAnswerEnd 分发到 onBotAnswerEnd 并携带 payload', () => {
  const calls = [];
  dispatchTrainV2Message(
    { onBotAnswerEnd: p => calls.push(p) },
    JSON.stringify({ event: 'botAnswerEnd', payload: { content: '你好', roleNid: 'r1', roleNickname: '客户' } }),
  );
  assert.deepEqual(calls, [{ content: '你好', roleNid: 'r1', roleNickname: '客户' }]);
});

test('nextStep / selectRoleEnd / continueSuperseded / scriptEnd / error 各自分发', () => {
  const seen = [];
  const handlers = {
    onNextStep: p => seen.push(['nextStep', p.nextStepId]),
    onSelectRoleEnd: p => seen.push(['selectRoleEnd', p.roleNid]),
    onContinueSuperseded: () => seen.push(['continueSuperseded']),
    onScriptEnd: () => seen.push(['scriptEnd']),
    onServerError: p => seen.push(['error', p.msg]),
  };
  dispatchTrainV2Message(handlers, JSON.stringify({ event: 'nextStep', payload: { nextStepId: 's2' } }));
  dispatchTrainV2Message(handlers, JSON.stringify({ event: 'selectRoleEnd', payload: { roleNid: 'user' } }));
  dispatchTrainV2Message(handlers, JSON.stringify({ event: 'continueSuperseded' }));
  dispatchTrainV2Message(handlers, JSON.stringify({ event: 'scriptEnd' }));
  dispatchTrainV2Message(handlers, JSON.stringify({ event: 'error', payload: { msg: 'boom' } }));
  assert.deepEqual(seen, [
    ['nextStep', 's2'],
    ['selectRoleEnd', 'user'],
    ['continueSuperseded'],
    ['scriptEnd'],
    ['error', 'boom'],
  ]);
});

test('协议内已知忽略事件不触发 onUnknownEvent；未知事件触发', () => {
  const unknown = [];
  const handlers = { onUnknownEvent: event => unknown.push(event) };
  for (const event of ['selectRoleStart', 'botAnswer', 'audioStart', 'audioEnd', 'heartbeatAck']) {
    dispatchTrainV2Message(handlers, JSON.stringify({ event, payload: {} }));
  }
  dispatchTrainV2Message(handlers, JSON.stringify({ event: 'mystery' }));
  assert.deepEqual(unknown, ['mystery']);
});

test('坏 JSON 返回 false，合法 JSON 返回 true', () => {
  assert.equal(dispatchTrainV2Message({}, 'not-json'), false);
  assert.equal(dispatchTrainV2Message({}, JSON.stringify({ event: 'connected', payload: {} })), true);
});

test('协议常量与 auto_train_pro.py 实测一致', () => {
  assert.equal(HEARTBEAT_INTERVAL_MS, 30_000);
  assert.equal(TRAIN_V2_WS_BASE, 'wss://cloudapi.polymas.com/ai-platform/ws/trainV2');
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --experimental-strip-types --test pages/side-panel/src/services/ws/train-v2-client.test.mjs`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现客户端**

创建 `pages/side-panel/src/services/ws/train-v2-client.ts`：

```typescript
/**
 * 能力训练 Pro trainV2 WebSocket 客户端
 * 协议对齐 auto_train_pro.py（HAR 实测验证）：连接成功即发 scriptStart；
 * TTS 以二进制 MP3 帧下发，本客户端不播放、直接丢弃，但计入活动序号，
 * 供「阶段开场应答」的安静判定使用。心跳走应用层 heartBeat（服务端不依赖协议层 ping）。
 */

interface TrainV2ConnectedPayload {
  connectType?: string;
}

interface TrainV2NextStepPayload {
  nextStepId: string;
  status?: string;
}

interface TrainV2SelectRoleEndPayload {
  roleNid: string;
  roleNickname?: string;
  roleName?: string;
}

interface TrainV2BotAnswerEndPayload {
  content: string;
  roleNid?: string;
  roleNickname?: string;
}

interface TrainV2Handlers {
  onConnected?(p: TrainV2ConnectedPayload): void;
  onNextStep?(p: TrainV2NextStepPayload): void;
  onSelectRoleEnd?(p: TrainV2SelectRoleEndPayload): void;
  onBotAnswerStart?(): void;
  onBotAnswerEnd?(p: TrainV2BotAnswerEndPayload): void;
  onContinueSuperseded?(): void;
  onStepEnd?(): void;
  onScriptEnd?(): void;
  onServerError?(payload: unknown): void;
  onOpen?(): void;
  onClose?(ev: CloseEvent): void;
  onUnknownEvent?(event: string, payload: unknown): void;
}

const TRAIN_V2_WS_BASE = 'wss://cloudapi.polymas.com/ai-platform/ws/trainV2';
// auto_train_pro.py 实测值：应用层心跳 30s；握手超时 10s
const HEARTBEAT_INTERVAL_MS = 30_000;
const OPEN_TIMEOUT_MS = 10_000;

// 协议内已知、无需业务处理的事件（对齐脚本 handle_message 中的显式 pass 分支；
// botAnswer 为流式分片，统一取 botAnswerEnd 整句）
const IGNORED_EVENTS = new Set(['selectRoleStart', 'botAnswer', 'audioStart', 'audioEnd', 'heartbeatAck']);

/** 纯函数：解析并分发一条文本帧。返回 false 表示 JSON 解析失败。 */
const dispatchTrainV2Message = (handlers: TrainV2Handlers, raw: string): boolean => {
  let parsed: { event?: string; payload?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return false;
  }
  const event = parsed.event ?? '';
  const payload = parsed.payload ?? {};
  switch (event) {
    case 'connected':
      handlers.onConnected?.(payload as TrainV2ConnectedPayload);
      break;
    case 'nextStep':
      handlers.onNextStep?.(payload as TrainV2NextStepPayload);
      break;
    case 'selectRoleEnd':
      handlers.onSelectRoleEnd?.(payload as TrainV2SelectRoleEndPayload);
      break;
    case 'botAnswerStart':
      handlers.onBotAnswerStart?.();
      break;
    case 'botAnswerEnd':
      handlers.onBotAnswerEnd?.(payload as TrainV2BotAnswerEndPayload);
      break;
    case 'continueSuperseded':
      handlers.onContinueSuperseded?.();
      break;
    case 'stepEnd':
      handlers.onStepEnd?.();
      break;
    case 'scriptEnd':
      handlers.onScriptEnd?.();
      break;
    case 'error':
      handlers.onServerError?.(payload);
      break;
    default:
      if (!IGNORED_EVENTS.has(event)) {
        handlers.onUnknownEvent?.(event, payload);
      }
      break;
  }
  return true;
};

class TrainV2Client {
  private readonly url: string;
  private readonly handlers: TrainV2Handlers;
  private ws: WebSocket | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  // 每收到一条事件或音频帧 +1，供「阶段开场应答」检测服务端是否安静
  private activityCounter = 0;

  constructor(params: { taskId: string; userId: string; sessionId: string }, handlers: TrainV2Handlers) {
    const query = new URLSearchParams({
      taskId: params.taskId,
      userId: params.userId,
      sessionId: params.sessionId,
    });
    this.url = `${TRAIN_V2_WS_BASE}?${query.toString()}`;
    this.handlers = handlers;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      try {
        this.ws = new WebSocket(this.url);
      } catch (error) {
        reject(error);
        return;
      }
      this.ws.binaryType = 'arraybuffer';

      const openTimer = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error('WebSocket 握手超时（10s）'));
          this.close(4000);
        }
      }, OPEN_TIMEOUT_MS);

      this.ws.addEventListener('open', () => {
        clearTimeout(openTimer);
        if (!settled) {
          settled = true;
          this.startHeartbeat();
          // 对齐脚本：连接成功立即发 scriptStart（先于服务端 connected 事件）
          this.sendEvent('scriptStart');
          this.handlers.onOpen?.();
          resolve();
        }
      });

      this.ws.addEventListener('error', event => {
        if (!settled) {
          settled = true;
          clearTimeout(openTimer);
          reject(new Error('WebSocket 连接失败'));
        }
        console.warn('[pro-ws] error', event);
      });

      this.ws.addEventListener('close', ev => {
        this.stopHeartbeat();
        if (!settled) {
          settled = true;
          clearTimeout(openTimer);
          reject(new Error(`WebSocket 在握手期关闭: code=${ev.code}`));
        }
        this.handlers.onClose?.(ev);
      });

      this.ws.addEventListener('message', ev => this.handleMessage(ev));
    });
  }

  sendEvent(event: string, payload?: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[pro-ws] sendEvent skipped, ws not open', event);
      return;
    }
    // 对齐脚本 send_json：无 payload 时不携带该字段
    this.ws.send(JSON.stringify(payload === undefined ? { event } : { event, payload }));
  }

  close(code = 1000, reason = 'client close'): void {
    this.stopHeartbeat();
    if (this.ws && this.ws.readyState !== WebSocket.CLOSED && this.ws.readyState !== WebSocket.CLOSING) {
      try {
        this.ws.close(code, reason);
      } catch {
        // ignore
      }
    }
    this.ws = null;
  }

  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  get activitySeq(): number {
    return this.activityCounter;
  }

  private handleMessage(ev: MessageEvent): void {
    this.activityCounter += 1;
    if (typeof ev.data !== 'string') {
      // TTS MP3 音频帧：本期决策为不播放、直接丢弃（仅计入活动序号）
      return;
    }
    dispatchTrainV2Message(this.handlers, ev.data);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.sendEvent('heartBeat', {});
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

export { TrainV2Client, dispatchTrainV2Message, TRAIN_V2_WS_BASE, HEARTBEAT_INTERVAL_MS };
export type {
  TrainV2Handlers,
  TrainV2ConnectedPayload,
  TrainV2NextStepPayload,
  TrainV2SelectRoleEndPayload,
  TrainV2BotAnswerEndPayload,
};
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --experimental-strip-types --test pages/side-panel/src/services/ws/train-v2-client.test.mjs`
Expected: `pass 5`、`fail 0`。

- [ ] **Step 5: lint 与类型检查**

Run: `pnpm -F @extension/sidepanel lint && pnpm -F @extension/sidepanel type-check`
Expected: 均无错误。

- [ ] **Step 6: Commit**

```bash
git add pages/side-panel/src/services/ws/train-v2-client.ts pages/side-panel/src/services/ws/train-v2-client.test.mjs
git commit -m "feat(side-panel): add trainV2 websocket client"
```

---

### Task 3: useProAgentChat 状态机 Hook

**Files:**
- Create: `pages/side-panel/src/hooks/useProAgentChat.ts`

**Interfaces:**
- Consumes:
  - Task 1: `buildStudentAnswerInput` / `formatProLogEntry` / `ProTurn`
  - Task 2: `TrainV2Client` / `TrainV2Handlers`
  - 既有: `fetchPolymasUserInfo()`、`resolveTrainingMetadata()`、`generateStudentAnswer(aiQuestion, history)`、`agentLogStorage.createSession/addEntry`、`llmConfigStorage.get()`、`apiRequest` + `API_ENDPOINTS.QUERY_CONFIGURATION`
- Produces（Task 5 依赖，签名必须一致）:
  - `type ProState = 'IDLE' | 'CONNECTING' | 'RUNNING' | 'COMPLETED' | 'ERROR'`
  - `type ProTurnPhase = 'WAITING_BOT' | 'USER_TURN' | 'STAGE_ENTRY'`
  - `interface ProMessage`（对齐 ChatMessage 字段 + `roleLabel?: string`）
  - `useProAgentChat(trainTaskId: string | null)` 返回：`{ proState, turnPhase, messages, stepIndex, round, currentRoleNickname, isAutoRunning, isGenerating, error, start(): Promise<void>, stop(): void, sendStudentText(text: string): void, autoGenerate(): Promise<{ needConfig: boolean }>, startAutoRun(): Promise<{ needConfig: boolean }>, stopAutoRun(): void, reset(): void }`

行为要点（协议逻辑照搬 `auto_train_pro.py`，见规格）：非首阶段开场应答（等安静 2.5s → 发「好的」→ 等 botAnswerStart 60s，superseded/超时重试 ≤12 次）；全自动上限 40 轮触发即结束；LLM 失败时全自动自动暂停退回半交互；日志随每条发言增量写入（错误中断时已产生对话已在历史中）。

- [ ] **Step 1: 写入文件头、类型、常量与模块级工具**

创建 `pages/side-panel/src/hooks/useProAgentChat.ts`，写入：

```typescript
/**
 * 能力训练 Pro（trainV2）状态机 Hook
 * 协议与防死锁机制移植自 auto_train_pro.py（HAR 实测验证）。
 * 独立于 useAgentChat / useVoiceAgentChat，不共享运行时状态。
 */

import { apiRequest, API_ENDPOINTS } from '../services/background-bridge';
import { generateStudentAnswer } from '../services/llm-service';
import { fetchPolymasUserInfo } from '../services/polymas-user-service';
import { buildStudentAnswerInput, formatProLogEntry } from '../services/pro-conversation';
import { resolveTrainingMetadata } from '../services/training-metadata-service';
import { TrainV2Client } from '../services/ws/train-v2-client';
import { agentLogStorage, llmConfigStorage } from '@extension/storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProTurn } from '../services/pro-conversation';
import type { TrainV2Handlers } from '../services/ws/train-v2-client';

// 对齐 useAgentChat 的 ChatMessage 字段，追加 Pro 特有的角色昵称标签
interface ProMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  stepId?: string;
  isAutoGenerated?: boolean;
  modelId?: string;
  roleLabel?: string;
}

type ProState = 'IDLE' | 'CONNECTING' | 'RUNNING' | 'COMPLETED' | 'ERROR';
type ProTurnPhase = 'WAITING_BOT' | 'USER_TURN' | 'STAGE_ENTRY';

// ============ 协议常量（auto_train_pro.py 实测值，不做用户可配置项） ============
const STAGE_ENTRY_TEXT = '好的';
const STAGE_ENTRY_MAX_TRIES = 12;
// 每次开场应答后最多等多久判定「本阶段已启动」；需大于服务端首角色规划耗时（实测约 37s）
const STAGE_ENTRY_TIMEOUT_MS = 60_000;
// 连续安静该时长（无任何事件/音频帧）才发开场应答，否则会被 continueSuperseded 拒绝
const STAGE_ENTRY_QUIET_MS = 2_500;
const POLL_INTERVAL_MS = 500;
// 全自动轮数上限，防失控刷 LLM
const MAX_AUTO_TURNS = 40;

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

const generateId = () => `pro_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

// 对齐脚本 session_id：21 位 URL-safe 随机串
const generateWsSessionId = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
    .slice(0, 21);
};

interface TrainConfigurationResponse {
  trainTaskName?: string;
}

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

// 与 useVoiceAgentChat 中同构：仅用于日志会话命名，失败降级为 taskId
const fetchTrainTaskName = async (taskId: string): Promise<string | null> => {
  try {
    const response = await apiRequest<ApiResponse<TrainConfigurationResponse>>({
      endpoint: API_ENDPOINTS.QUERY_CONFIGURATION,
      method: 'POST',
      body: { trainTaskId: taskId },
    });
    const name = response?.data?.trainTaskName?.trim();
    return name && name.length > 0 ? name : null;
  } catch (error) {
    console.warn('[pro] 获取 trainTaskName 失败', error);
    return null;
  }
};
```

- [ ] **Step 2: 写入 hook 状态、refs 与基础回调**

继续追加：

```typescript
const useProAgentChat = (trainTaskId: string | null) => {
  const [proState, setProStateRaw] = useState<ProState>('IDLE');
  const [turnPhase, setTurnPhaseRaw] = useState<ProTurnPhase>('WAITING_BOT');
  const [messages, setMessages] = useState<ProMessage[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [round, setRound] = useState(0);
  const [currentRoleNickname, setCurrentRoleNickname] = useState<string | null>(null);
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<TrainV2Client | null>(null);
  const proStateRef = useRef<ProState>('IDLE');
  const turnPhaseRef = useRef<ProTurnPhase>('WAITING_BOT');
  const turnsRef = useRef<ProTurn[]>([]);
  const logSessionIdRef = useRef<string | null>(null);
  const stepIdRef = useRef<string | null>(null);
  const stepIndexRef = useRef(0);
  const roundRef = useRef(0);
  const autoRunRef = useRef(false);
  const currentRoleRef = useRef<{ nid: string; nickname: string } | null>(null);
  const botSpokeRef = useRef(false);
  const supersededRef = useRef(false);
  const stageEntryRunningRef = useRef(false);
  // 会话代际号：teardown 后递增，使旧会话遗留的异步循环立即退出
  const runSeqRef = useRef(0);

  // 状态写入同时同步 ref，避免 WS 回调读到过期值（事件到达早于 useEffect 同步）
  const setProState = useCallback((next: ProState) => {
    proStateRef.current = next;
    setProStateRaw(next);
  }, []);

  const setTurnPhase = useCallback((next: ProTurnPhase) => {
    turnPhaseRef.current = next;
    setTurnPhaseRaw(next);
  }, []);

  useEffect(() => {
    autoRunRef.current = isAutoRunning;
  }, [isAutoRunning]);

  const addMessage = useCallback(
    (
      role: ProMessage['role'],
      content: string,
      opts?: { roleLabel?: string; isAutoGenerated?: boolean; modelId?: string },
    ) => {
      const message: ProMessage = {
        id: generateId(),
        role,
        content,
        timestamp: Date.now(),
        stepId: stepIdRef.current ?? undefined,
        isAutoGenerated: opts?.isAutoGenerated,
        modelId: opts?.modelId,
        roleLabel: opts?.roleLabel,
      };
      setMessages(prev => [...prev, message]);
    },
    [],
  );

  const appendLog = useCallback(async (turn: ProTurn) => {
    const sessionId = logSessionIdRef.current;
    if (!sessionId) {
      return;
    }
    try {
      await agentLogStorage.addEntry(sessionId, {
        type: 'chat',
        timestamp: Date.now(),
        stepId: stepIdRef.current ?? 'unknown',
        stepName: `阶段 ${stepIndexRef.current}`,
        round: roundRef.current,
        source: 'chat',
        ...formatProLogEntry(turn),
      });
    } catch (err) {
      console.warn('[pro] append log failed', err);
    }
  }, []);

  // 记录一条对话轮次：入 LLM 上下文 + 聊天气泡 + 历史日志（增量写，错误中断也不丢已发生对话）
  const recordTurn = useCallback(
    (turn: ProTurn, opts?: { isAutoGenerated?: boolean; modelId?: string }) => {
      turnsRef.current = [...turnsRef.current, turn];
      const role = turn.role === 'user' ? 'user' : turn.role === 'coach' ? 'system' : 'assistant';
      addMessage(role, turn.content, {
        roleLabel: turn.role === 'user' ? undefined : turn.label,
        isAutoGenerated: opts?.isAutoGenerated,
        modelId: opts?.modelId,
      });
      void appendLog(turn);
    },
    [addMessage, appendLog],
  );

  const teardown = useCallback(() => {
    runSeqRef.current += 1;
    autoRunRef.current = false;
    setIsAutoRunning(false);
    setIsGenerating(false);
    stageEntryRunningRef.current = false;
    if (clientRef.current) {
      clientRef.current.close();
      clientRef.current = null;
    }
  }, []);

  // 正常收尾（scriptEnd / 手动停止 / 全自动上限）：界面回到空闲态样式，可直接重新开始
  const endRun = useCallback(
    (notice: string) => {
      addMessage('system', notice);
      setProState('COMPLETED');
      setTurnPhase('WAITING_BOT');
      teardown();
    },
    [addMessage, setProState, setTurnPhase, teardown],
  );

  const failRun = useCallback(
    (message: string) => {
      setError(message);
      addMessage('system', `❌ ${message}`);
      setProState('ERROR');
      setTurnPhase('WAITING_BOT');
      teardown();
    },
    [addMessage, setProState, setTurnPhase, teardown],
  );

  const isRunningSeq = useCallback(
    (seq: number) => runSeqRef.current === seq && proStateRef.current === 'RUNNING',
    [],
  );
```

- [ ] **Step 3: 写入学生发送、AI 作答与阶段开场应答**

继续追加：

```typescript
  const submitStudentText = useCallback(
    (text: string, opts?: { isAutoGenerated?: boolean; modelId?: string }) => {
      const client = clientRef.current;
      const trimmed = text.trim();
      if (!client || !trimmed || proStateRef.current !== 'RUNNING') {
        return;
      }
      roundRef.current += 1;
      setRound(roundRef.current);
      recordTurn({ role: 'user', label: '你(学生)', content: trimmed }, opts);
      // 协议：学生回合 = userTextInput + 恰好一次 continueCurrentStep
      client.sendEvent('userTextInput', { text: trimmed });
      client.sendEvent('continueCurrentStep');
      setTurnPhase('WAITING_BOT');
    },
    [recordTurn, setTurnPhase],
  );

  const sendStudentText = useCallback(
    (text: string) => {
      submitStudentText(text);
    },
    [submitStudentText],
  );

  const generateAndSend = useCallback(
    async (seq: number): Promise<{ needConfig: boolean; ok: boolean }> => {
      const config = await llmConfigStorage.get();
      if (!config.apiKey) {
        return { needConfig: true, ok: false };
      }
      setIsGenerating(true);
      try {
        const { aiQuestion, history } = buildStudentAnswerInput(turnsRef.current);
        const result = await generateStudentAnswer(aiQuestion, history);
        if (!isRunningSeq(seq) || turnPhaseRef.current !== 'USER_TURN') {
          return { needConfig: false, ok: false };
        }
        if (!result.success || !result.content) {
          setError(result.error ?? 'AI 生成失败');
          addMessage('system', `⚠️ AI 生成失败：${result.error ?? '未知错误'}，请手动输入或重试`);
          return { needConfig: false, ok: false };
        }
        submitStudentText(result.content, { isAutoGenerated: true, modelId: config.model });
        return { needConfig: false, ok: true };
      } finally {
        setIsGenerating(false);
      }
    },
    [addMessage, isRunningSeq, submitStudentText],
  );

  // 全自动路径：上限触发即主动结束；LLM 失败自动暂停退回半交互（不静默发兜底假答案）
  const autoAnswer = useCallback(
    async (seq: number) => {
      if (roundRef.current >= MAX_AUTO_TURNS) {
        endRun(`⏹ 已达全自动上限（${MAX_AUTO_TURNS} 轮），训练已自动结束`);
        return;
      }
      const result = await generateAndSend(seq);
      if (!result.ok) {
        autoRunRef.current = false;
        setIsAutoRunning(false);
        if (result.needConfig) {
          addMessage('system', '⚠️ 请先配置 LLM API Key，再使用 AI 作答');
        }
      }
    },
    [addMessage, endRun, generateAndSend],
  );

  const waitQuiet = useCallback(
    async (seq: number) => {
      for (;;) {
        const client = clientRef.current;
        if (!client || !isRunningSeq(seq)) {
          return;
        }
        const prev = client.activitySeq;
        await sleep(STAGE_ENTRY_QUIET_MS);
        if ((clientRef.current?.activitySeq ?? prev) === prev) {
          return;
        }
      }
    },
    [isRunningSeq],
  );

  /**
   * 非首阶段开场应答（脚本 _handle_stage_entry 的移植）：
   * stepStart 后服务端停在 selectRoleStart 等学生先应答一句，否则本阶段永久卡死。
   * 过早发送会被 continueSuperseded 拒绝，故：等安静 → 发「好的」→ 等 botAnswerStart；
   * 被拒或超时则重试，最多 STAGE_ENTRY_MAX_TRIES 次。
   * 开场应答是协议解锁动作而非教学回合，半交互与全自动一律自动发送。
   */
  const runStageEntry = useCallback(
    async (seq: number) => {
      if (stageEntryRunningRef.current) {
        return;
      }
      stageEntryRunningRef.current = true;
      try {
        setTurnPhase('STAGE_ENTRY');
        roundRef.current += 1;
        setRound(roundRef.current);
        recordTurn({ role: 'user', label: '你(学生)', content: STAGE_ENTRY_TEXT }, { isAutoGenerated: true });
        for (let attempt = 1; attempt <= STAGE_ENTRY_MAX_TRIES; attempt++) {
          await waitQuiet(seq);
          if (!isRunningSeq(seq)) {
            return;
          }
          botSpokeRef.current = false;
          supersededRef.current = false;
          clientRef.current?.sendEvent('userTextInput', { text: STAGE_ENTRY_TEXT });
          clientRef.current?.sendEvent('continueCurrentStep');
          let waited = 0;
          while (waited < STAGE_ENTRY_TIMEOUT_MS) {
            if (botSpokeRef.current) {
              setTurnPhase('WAITING_BOT');
              return;
            }
            if (supersededRef.current) {
              break;
            }
            if (!isRunningSeq(seq)) {
              return;
            }
            await sleep(POLL_INTERVAL_MS);
            waited += POLL_INTERVAL_MS;
          }
        }
        failRun('阶段开场多次重试仍未启动本阶段（服务端可能异常）');
      } finally {
        stageEntryRunningRef.current = false;
      }
    },
    [failRun, isRunningSeq, recordTurn, setTurnPhase, waitQuiet],
  );
```

- [ ] **Step 4: 写入 start / stop / reset / 公开作答接口与返回值**

继续追加（到文件末尾，`export` 收尾）：

```typescript
  const autoGenerate = useCallback(async (): Promise<{ needConfig: boolean }> => {
    if (proStateRef.current !== 'RUNNING' || turnPhaseRef.current !== 'USER_TURN') {
      return { needConfig: false };
    }
    const result = await generateAndSend(runSeqRef.current);
    return { needConfig: result.needConfig };
  }, [generateAndSend]);

  const startAutoRun = useCallback(async (): Promise<{ needConfig: boolean }> => {
    const config = await llmConfigStorage.get();
    if (!config.apiKey) {
      return { needConfig: true };
    }
    autoRunRef.current = true;
    setIsAutoRunning(true);
    if (proStateRef.current === 'RUNNING' && turnPhaseRef.current === 'USER_TURN') {
      void autoAnswer(runSeqRef.current);
    }
    return { needConfig: false };
  }, [autoAnswer]);

  const stopAutoRun = useCallback(() => {
    autoRunRef.current = false;
    setIsAutoRunning(false);
  }, []);

  const start = useCallback(async () => {
    if (!trainTaskId) {
      setError('未找到训练任务ID，请在训练页面打开');
      return;
    }
    if (clientRef.current || proStateRef.current === 'CONNECTING' || proStateRef.current === 'RUNNING') {
      return;
    }
    const seq = runSeqRef.current + 1;
    runSeqRef.current = seq;
    setMessages([]);
    turnsRef.current = [];
    stepIdRef.current = null;
    stepIndexRef.current = 0;
    setStepIndex(0);
    roundRef.current = 0;
    setRound(0);
    currentRoleRef.current = null;
    setCurrentRoleNickname(null);
    setError(null);
    stageEntryRunningRef.current = false;
    setProState('CONNECTING');
    setTurnPhase('WAITING_BOT');
    addMessage('system', '正在获取用户信息...');

    try {
      const [userInfo, resolvedTaskName, trainingMeta] = await Promise.all([
        fetchPolymasUserInfo(),
        fetchTrainTaskName(trainTaskId),
        resolveTrainingMetadata(),
      ]);
      const taskDisplayName = resolvedTaskName || trainTaskId;

      const config = await llmConfigStorage.get();
      const profile = config.studentProfiles.find(p => p.id === config.studentProfileId) ?? config.studentProfiles[0];
      const profileLabel = profile?.label?.trim() || '学生';
      try {
        const session = await agentLogStorage.createSession({
          taskId: trainTaskId,
          taskName: `${taskDisplayName}-${profileLabel}-Pro`,
          trainingMeta,
          stepNameMapping: {},
        });
        logSessionIdRef.current = session.id;
      } catch (logError) {
        console.warn('[pro] 日志初始化失败', logError);
      }

      addMessage('system', `训练任务：${taskDisplayName}`);

      const handlers: TrainV2Handlers = {
        onConnected: payload => {
          console.log('[pro] connected', payload.connectType);
        },
        onNextStep: payload => {
          stepIdRef.current = payload.nextStepId;
          stepIndexRef.current += 1;
          setStepIndex(stepIndexRef.current);
          clientRef.current?.sendEvent('stepStart', { stepId: payload.nextStepId });
          // 首阶段由 scriptStart 自动开场；非首阶段需学生开场应答，否则永久卡死
          if (stepIndexRef.current >= 2) {
            void runStageEntry(seq);
          }
        },
        onSelectRoleEnd: payload => {
          if (payload.roleNid === 'user') {
            currentRoleRef.current = null;
            setCurrentRoleNickname(null);
            setTurnPhase('USER_TURN');
            if (autoRunRef.current) {
              void autoAnswer(seq);
            }
          } else {
            currentRoleRef.current = {
              nid: payload.roleNid,
              nickname: payload.roleNickname ?? payload.roleName ?? '对方',
            };
            setCurrentRoleNickname(currentRoleRef.current.nickname);
            setTurnPhase('WAITING_BOT');
          }
        },
        onBotAnswerStart: () => {
          // 有角色开口 = 本阶段已启动（供阶段开场重试判定成功）
          botSpokeRef.current = true;
        },
        onBotAnswerEnd: payload => {
          const nid = payload.roleNid ?? currentRoleRef.current?.nid ?? '';
          const nickname = payload.roleNickname ?? currentRoleRef.current?.nickname ?? '对方';
          if (nid === 'system') {
            recordTurn({ role: 'coach', label: '教练点评', content: payload.content });
          } else {
            recordTurn({ role: 'bot', label: nickname, content: payload.content });
          }
          // 协议：每个角色回合结束发恰好一次 continueCurrentStep
          clientRef.current?.sendEvent('continueCurrentStep');
        },
        onContinueSuperseded: () => {
          supersededRef.current = true;
        },
        onScriptEnd: () => {
          endRun('🎉 训练完成！');
        },
        onServerError: payload => {
          failRun(`服务端错误：${JSON.stringify(payload)}`);
        },
        onClose: () => {
          if (proStateRef.current === 'RUNNING' || proStateRef.current === 'CONNECTING') {
            failRun('连接已断开');
          }
        },
      };

      const client = new TrainV2Client(
        { taskId: trainTaskId, userId: userInfo.userId, sessionId: generateWsSessionId() },
        handlers,
      );
      clientRef.current = client;
      await client.connect();
      if (runSeqRef.current !== seq) {
        client.close();
        return;
      }
      setProState('RUNNING');
      addMessage('system', '连接成功，剧本已启动，等待角色分配...');
    } catch (err) {
      clientRef.current = null;
      failRun(err instanceof Error ? err.message : '连接失败');
    }
  }, [trainTaskId, addMessage, autoAnswer, endRun, failRun, recordTurn, runStageEntry, setProState, setTurnPhase]);

  const stop = useCallback(() => {
    if (proStateRef.current !== 'RUNNING' && proStateRef.current !== 'CONNECTING') {
      return;
    }
    endRun('⏹ 已手动停止训练');
  }, [endRun]);

  const reset = useCallback(() => {
    teardown();
    setProState('IDLE');
    setTurnPhase('WAITING_BOT');
    setMessages([]);
    turnsRef.current = [];
    stepIdRef.current = null;
    stepIndexRef.current = 0;
    setStepIndex(0);
    roundRef.current = 0;
    setRound(0);
    currentRoleRef.current = null;
    setCurrentRoleNickname(null);
    setError(null);
    logSessionIdRef.current = null;
  }, [setProState, setTurnPhase, teardown]);

  // 组件卸载时断开连接
  useEffect(
    () => () => {
      clientRef.current?.close();
      clientRef.current = null;
    },
    [],
  );

  return {
    proState,
    turnPhase,
    messages,
    stepIndex,
    round,
    currentRoleNickname,
    isAutoRunning,
    isGenerating,
    error,
    start,
    stop,
    sendStudentText,
    autoGenerate,
    startAutoRun,
    stopAutoRun,
    reset,
  };
};

export { useProAgentChat };
export type { ProState, ProTurnPhase, ProMessage };
```

- [ ] **Step 5: lint 与类型检查**

Run: `pnpm -F @extension/sidepanel lint && pnpm -F @extension/sidepanel type-check`
Expected: 均无错误。若 ESLint 提示 `react-hooks/exhaustive-deps`，按提示补齐依赖数组（不要禁用规则）。

- [ ] **Step 6: Commit**

```bash
git add pages/side-panel/src/hooks/useProAgentChat.ts
git commit -m "feat(side-panel): add pro training state machine hook"
```

---

### Task 4: UI 基建 — 角色标签与 ChatInput 可选按钮

**Files:**
- Modify: `pages/side-panel/src/SidePanel.tsx`（MessageBubble、MessageList、ChatInput 三处；行号以内容锚点为准，该文件有并行改动）

**Interfaces:**
- Consumes: 现有 `ChatMessage`（`hooks/useAgentChat.ts` 导出类型，不修改）。
- Produces（Task 5 依赖）:
  - `MessageBubble` / `MessageList` 接受 `ChatMessage & { roleLabel?: string }`，有 `roleLabel` 时优先显示为角色标签。
  - `ChatInput` 新增可选 props：`showDebug?: boolean`（默认 `true`）、`showMultiRole?: boolean`（默认 `true`）、`placeholder?: string`（默认 `'输入你的回答...'`）。默认值下现有文字模式渲染结果不变。

- [ ] **Step 1: MessageBubble 支持 roleLabel**

签名从：

```tsx
const MessageBubble = ({ message }: { message: ChatMessage }) => {
```

改为：

```tsx
const MessageBubble = ({ message }: { message: ChatMessage & { roleLabel?: string } }) => {
```

角色标识行从：

```tsx
          {isUser ? '你' : isSystem ? '系统提示' : 'AI 助手'}
```

改为：

```tsx
          {isUser ? '你' : (message.roleLabel ?? (isSystem ? '系统提示' : 'AI 助手'))}
```

- [ ] **Step 2: MessageList 放宽消息类型**

签名从：

```tsx
const MessageList = ({ messages, isLoading }: { messages: ChatMessage[]; isLoading: boolean }) => {
```

改为：

```tsx
const MessageList = ({
  messages,
  isLoading,
}: {
  messages: Array<ChatMessage & { roleLabel?: string }>;
  isLoading: boolean;
}) => {
```

- [ ] **Step 3: ChatInput 增加可选 props**

props 解构与类型中加入三个可选项（其余保持不变）：

```tsx
const ChatInput = ({
  onSend,
  onAutoGenerate,
  onAutoRun,
  onStopAutoRun,
  isAutoRunning,
  onOpenDebug,
  onOpenSimulationConfig,
  onOpenMultiRole,
  simulationConfig,
  onToggleDialogueSimulation,
  onToggleKnowledgeBase,
  toggleDisabled,
  debugDisabled,
  disabled,
  showDebug = true,
  showMultiRole = true,
  placeholder = '输入你的回答...',
}: {
  onSend: (content: string) => void;
  onAutoGenerate: () => void;
  onAutoRun: () => void;
  onStopAutoRun: () => void;
  isAutoRunning: boolean;
  onOpenDebug: () => void;
  onOpenSimulationConfig: () => void;
  onOpenMultiRole: () => void;
  simulationConfig: SimulationModeState;
  onToggleDialogueSimulation: (enabled: boolean) => void;
  onToggleKnowledgeBase: (enabled: boolean) => void;
  toggleDisabled: boolean;
  debugDisabled: boolean;
  disabled: boolean;
  showDebug?: boolean;
  showMultiRole?: boolean;
  placeholder?: string;
}) => {
```

「调试模式」按钮块（含说明文字的 `<div className="flex flex-col items-start gap-1">…</div>`）外层包裹 `{showDebug && (…)}`；「多角色并行」按钮块同样包裹 `{showMultiRole && (…)}`。textarea 的 `placeholder="输入你的回答..."` 改为 `placeholder={placeholder}`。

- [ ] **Step 4: 验证既有行为未变**

Run: `node --test pages/side-panel/src/SidePanel.idle-controls.test.mjs && pnpm -F @extension/sidepanel lint && pnpm -F @extension/sidepanel type-check`
Expected: 测试通过、lint 与类型检查无错误。

- [ ] **Step 5: Commit**

```bash
git add pages/side-panel/src/SidePanel.tsx
git commit -m "refactor(side-panel): role labels and optional chat input controls"
```

---

### Task 5: SidePanel pro 分支接线

**Files:**
- Modify: `pages/side-panel/src/SidePanel.tsx`

**Interfaces:**
- Consumes: Task 3 的 `useProAgentChat` / `ProState`；Task 4 的 `MessageList`（roleLabel）与 `ChatInput`（`showDebug/showMultiRole/placeholder`）；现有 `IdleTrainingPanel`、`Header`、`STATE_CONFIG`、`WorkflowState`。
- Produces: `mode === 'pro'` 时的完整 UI；训练中禁用模式切换；切换模式/重置时清理 pro 会话。

- [ ] **Step 1: 引入 hook 与状态映射常量**

import 区加入：

```tsx
import { useProAgentChat } from './hooks/useProAgentChat';
import type { ProState } from './hooks/useProAgentChat';
```

`TRAINING_MODE_TITLES` 定义之后新增：

```tsx
// Pro 状态 → Header 状态条展示映射
const PRO_HEADER_STATE: Record<ProState, WorkflowState> = {
  IDLE: 'IDLE',
  CONNECTING: 'FETCHING_STEPS',
  RUNNING: 'CHATTING',
  COMPLETED: 'COMPLETED',
  ERROR: 'ERROR',
};
```

- [ ] **Step 2: 新增 ProChatArea 本地组件**

放在 `VoiceChatArea` 组件之后、`SidePanel` 之前：

```tsx
// ============ 能力训练 Pro 内容区 ============
interface ProChatAreaProps {
  pro: ReturnType<typeof useProAgentChat>;
  trainTaskId: string | null;
  simulationConfig: SimulationModeState;
  onToggleSimulation: (enabled: boolean) => void;
  onToggleKnowledge: (enabled: boolean) => void;
  onOpenSimulationConfig: () => void;
  onAutoGenerate: () => void;
  onAutoRunToggle: () => void;
  toggleDisabled: boolean;
}

const ProChatArea = ({
  pro,
  trainTaskId,
  simulationConfig,
  onToggleSimulation,
  onToggleKnowledge,
  onOpenSimulationConfig,
  onAutoGenerate,
  onAutoRunToggle,
  toggleDisabled,
}: ProChatAreaProps) => {
  const isRunning = pro.proState === 'RUNNING';
  const isConnecting = pro.proState === 'CONNECTING';
  const waitingLabel = `等待${pro.currentRoleNickname ?? '对方'}发言…`;
  const statusText = isConnecting
    ? '连接中…'
    : pro.turnPhase === 'USER_TURN'
      ? '轮到你发言'
      : pro.turnPhase === 'STAGE_ENTRY'
        ? '阶段启动中…'
        : waitingLabel;

  return (
    <>
      {/* Pro 状态条：阶段序号 + 连接/回合状态 + 停止 */}
      {(isRunning || isConnecting) && (
        <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2 text-xs text-slate-600">
          <span className="font-medium">阶段 #{Math.max(pro.stepIndex, 1)}</span>
          <span className="text-slate-300">|</span>
          <span>{statusText}</span>
          <button
            onClick={pro.stop}
            className="ml-auto flex cursor-pointer items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-red-600 transition-all duration-200 hover:border-red-300 hover:bg-red-100">
            停止
          </button>
        </div>
      )}

      <MessageList messages={pro.messages} isLoading={pro.isGenerating || isConnecting} />

      {isRunning ? (
        <ChatInput
          onSend={pro.sendStudentText}
          onAutoGenerate={onAutoGenerate}
          onAutoRun={onAutoRunToggle}
          onStopAutoRun={pro.stopAutoRun}
          isAutoRunning={pro.isAutoRunning}
          onOpenDebug={() => {}}
          onOpenSimulationConfig={onOpenSimulationConfig}
          onOpenMultiRole={() => {}}
          simulationConfig={simulationConfig}
          onToggleDialogueSimulation={onToggleSimulation}
          onToggleKnowledgeBase={onToggleKnowledge}
          toggleDisabled={toggleDisabled}
          debugDisabled
          disabled={pro.turnPhase !== 'USER_TURN' || pro.isGenerating}
          showDebug={false}
          showMultiRole={false}
          placeholder={pro.turnPhase === 'USER_TURN' ? '输入你的回答...' : waitingLabel}
        />
      ) : (
        <IdleTrainingPanel
          simulationConfig={simulationConfig}
          onToggleSimulation={onToggleSimulation}
          onToggleKnowledge={onToggleKnowledge}
          onOpenSimulationConfig={onOpenSimulationConfig}
          onStart={() => {
            void pro.start();
          }}
          isLoading={isConnecting}
          trainTaskId={trainTaskId}
        />
      )}
    </>
  );
};
```

- [ ] **Step 3: SidePanel 主体接线**

`const voice = useVoiceAgentChat();` 之后加入：

```tsx
  // 能力训练 Pro hook
  const pro = useProAgentChat(trainTaskId);
```

`handleVoiceAutoRunToggle` 之后加入两个处理函数：

```tsx
  const handleProAutoGenerate = async () => {
    const result = await pro.autoGenerate();
    if (result.needConfig) {
      setIsConfigPromptOpen(true);
    }
  };

  const handleProAutoRunToggle = async () => {
    if (pro.isAutoRunning) {
      pro.stopAutoRun();
      return;
    }
    const result = await pro.startAutoRun();
    if (result.needConfig) {
      setIsConfigPromptOpen(true);
    }
  };
```

忙碌判定行从：

```tsx
  const modeToggleDisabled = mode === 'voice' ? voiceBusy : textBusy;
```

改为：

```tsx
  const proBusy = pro.proState === 'CONNECTING' || pro.proState === 'RUNNING';
  const modeToggleDisabled = mode === 'voice' ? voiceBusy : mode === 'pro' ? proBusy : textBusy;
```

`handleResetAll` 与 `handleChangeMode` 中在 `voice.reset();` 之后各加一行 `pro.reset();`。

- [ ] **Step 4: Header 与内容区分支**

非 voice 的 `<Header ...>` 中两个 props 改为：

```tsx
          workflowState={
            mode === 'pro' ? PRO_HEADER_STATE[pro.proState] : multiRole.isMultiRoleMode ? 'CHATTING' : workflowState
          }
          dialogueRound={mode === 'pro' ? pro.round : multiRole.isMultiRoleMode ? 0 : dialogueRound}
```

内容区在 voice 分支与 multiRole 分支之间插入 pro 分支，即把：

```tsx
      ) : multiRole.isMultiRoleMode && multiRole.batch ? (
```

改为：

```tsx
      ) : mode === 'pro' ? (
        <ProChatArea
          pro={pro}
          trainTaskId={trainTaskId}
          simulationConfig={simulationConfig}
          onToggleSimulation={enabled => {
            void handleToggleDialogueSimulation(enabled);
          }}
          onToggleKnowledge={enabled => {
            void handleToggleKnowledgeBase(enabled);
          }}
          onOpenSimulationConfig={() => setIsSimulationConfigOpen(true)}
          onAutoGenerate={() => {
            void handleProAutoGenerate();
          }}
          onAutoRunToggle={() => {
            void handleProAutoRunToggle();
          }}
          toggleDisabled={pro.isGenerating}
        />
      ) : multiRole.isMultiRoleMode && multiRole.batch ? (
```

- [ ] **Step 5: 验证**

Run: `node --test pages/side-panel/src/SidePanel.idle-controls.test.mjs && pnpm -F @extension/sidepanel lint && pnpm -F @extension/sidepanel type-check`
Expected: 全部通过。

- [ ] **Step 6: Commit**

```bash
git add pages/side-panel/src/SidePanel.tsx
git commit -m "feat(side-panel): wire pro training mode to trainV2 flow"
```

---

### Task 6: 全量验证与手动 e2e

**Files:**
- 无新增；如手动验证发现缺陷，修复后按缺陷单独提交。

- [ ] **Step 1: 全部自动化检查**

```bash
node --experimental-strip-types --test \
  pages/side-panel/src/services/pro-conversation.test.mjs \
  pages/side-panel/src/services/ws/train-v2-client.test.mjs \
  pages/side-panel/src/SidePanel.idle-controls.test.mjs
pnpm -F @extension/sidepanel lint
pnpm -F @extension/sidepanel type-check
pnpm build
```

Expected: 测试全过、lint/类型无错、`dist/` 生产构建成功。

- [ ] **Step 2: 手动 e2e（真实 Pro 任务页）**

前置：`chrome://extensions` 加载 `dist/`；登录 `hike-teaching-center.polymas.com`；打开 URL 含 `trainTaskId=PRO…` 的 Pro 任务页；侧边栏配置好 LLM API Key。

三条路径逐一验证并记录结果：

1. **全自动跑完**：选 Pro 模式 → 开始训练 → 开启「自动运行」→ 观察多角色气泡（角色昵称标签）、教练点评样式、非首阶段自动发「好的」并推进、直至「🎉 训练完成」；打开「历史」确认新会话（名称含 `-Pro`）完整包含多角色对话。
2. **半交互混合**：新开一轮 → 轮到学生时分别验证手动输入发送、「AI 生成」按钮、中途开/关自动运行；非学生回合输入框禁用且显示「等待〈角色〉发言…」。
3. **中途停止**：训练中点状态条「停止」→ 界面回到空闲态样式、可再次开始；历史中已有部分对话。

- [ ] **Step 3: （如有修复）提交并复跑检查**

修复类提交示例：`fix(side-panel): <具体缺陷>`；每次修复后复跑 Step 1。

## 手动验证已知风险点

- WS 握手依赖 polymas.com 登录 Cookie 自动携带；未登录时应走到「连接失败/握手超时」ERROR 路径而非卡死。
- 阶段开场应答的 60s 等待期间服务端在规划角色（实测约 37s），状态条显示「阶段启动中…」属正常，勿误判为卡死。
- 服务端 TTS 音频帧较大，确认丢弃逻辑下 UI 无卡顿、无内存增长异常。
