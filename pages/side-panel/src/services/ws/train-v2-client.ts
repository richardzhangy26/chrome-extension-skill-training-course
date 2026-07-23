/**
 * 能力训练 Pro trainV2 WebSocket 客户端
 * 协议对齐 auto_train_pro.py（HAR 实测验证）：连接成功即发 scriptStart；
 * TTS 以二进制 MP3 帧下发，本客户端不播放、直接丢弃，但计入活动序号，
 * 供「阶段开场应答」的安静判定使用。心跳走应用层 heartBeat（服务端不依赖协议层 ping）。
 */

import { createTrainV2PageRelaySocket, TRAIN_V2_SOCKET_STATE } from './train-v2-page-relay';
import { throttleSafeSleep } from '../timing/throttle-safe-sleep';
import type {
  TrainV2CloseInfo,
  TrainV2ConnectionParams,
  TrainV2Socket,
  TrainV2SocketFactory,
} from './train-v2-page-relay';

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
  onClose?(info: TrainV2CloseInfo): void;
  onUnknownEvent?(event: string, payload: unknown): void;
}

type TrainV2ConnectionPhase = 'handshake' | 'connected';
type TrainV2DiagnosticLevel = 'debug' | 'warn';
type TrainV2Sleep = (ms: number, signal?: AbortSignal) => Promise<void>;

const TRAIN_V2_WS_BASE = 'wss://cloudapi.polymas.com/ai-platform/ws/trainV2';
// auto_train_pro.py 实测值：应用层心跳 30s；握手超时 10s
const HEARTBEAT_INTERVAL_MS = 30_000;
const OPEN_TIMEOUT_MS = 10_000;

const buildTrainV2CloseDiagnostic = (
  close: TrainV2CloseInfo,
  phase: TrainV2ConnectionPhase,
): { level: TrainV2DiagnosticLevel; message: string } => ({
  level: close.code === 1000 && close.wasClean ? 'debug' : 'warn',
  message: `[pro-ws] close code=${close.code} reason=${close.reason || '(空)'} wasClean=${close.wasClean} phase=${phase}`,
});

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
  private readonly params: TrainV2ConnectionParams;
  private readonly handlers: TrainV2Handlers;
  private readonly socketFactory: TrainV2SocketFactory;
  private readonly sleep: TrainV2Sleep;
  private ws: TrainV2Socket | null = null;
  private heartbeatAbort: AbortController | null = null;
  // 每收到一条事件或音频帧 +1，供「阶段开场应答」检测服务端是否安静
  private activityCounter = 0;

  constructor(
    params: TrainV2ConnectionParams,
    handlers: TrainV2Handlers,
    socketFactory: TrainV2SocketFactory = createTrainV2PageRelaySocket,
    sleep: TrainV2Sleep = throttleSafeSleep,
  ) {
    this.params = params;
    this.handlers = handlers;
    this.socketFactory = socketFactory;
    this.sleep = sleep;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      let opened = false;
      const openAbort = new AbortController();
      const settleRejected = (error: Error): void => {
        if (settled) return;
        settled = true;
        openAbort.abort();
        reject(error);
      };
      try {
        this.ws = this.socketFactory(this.params);
      } catch (error) {
        reject(error);
        return;
      }
      this.ws.binaryType = 'arraybuffer';

      // 握手超时同样走防节流 sleep：页面隐藏后裸 setTimeout 会被 Chrome 节流延迟触发
      void this.sleep(OPEN_TIMEOUT_MS, openAbort.signal).then(() => {
        if (settled) return;
        settleRejected(new Error('WebSocket 握手超时（10s）'));
        this.close(4000, 'handshake timeout');
      });

      this.ws.addEventListener('open', () => {
        if (settled || opened) return;
        opened = true;
        settled = true;
        openAbort.abort();
        this.startHeartbeat();
        // 对齐脚本：连接成功立即发 scriptStart（先于服务端 connected 事件）
        this.sendEvent('scriptStart');
        this.handlers.onOpen?.();
        resolve();
      });

      this.ws.addEventListener('error', () => {
        const phase = opened ? 'connected' : 'handshake';
        settleRejected(new Error('WebSocket 连接失败'));
        // 浏览器 error 事件不透明（无细节）；真正原因看紧随其后的 [pro-ws] close code，
        // 以及 DevTools Network 面板里该 trainV2 请求的握手 HTTP 状态（200/401 等 JS 无法读取）。
        console.warn(`[pro-ws] error (phase=${phase}, 细节不透明，见下方 close code 与 Network 握手状态)`);
      });

      this.ws.addEventListener('close', ev => {
        const close = ev as TrainV2CloseInfo;
        this.stopHeartbeat();
        // close code 是握手/连接失败的关键诊断信号（1006=服务器在建立前就断，典型握手被拒）。
        // 始终打印：error 先触发会把 settled 置真，此前该 code 被 if(!settled) 挡掉、无处可见。
        const diagnostic = buildTrainV2CloseDiagnostic(close, opened ? 'connected' : 'handshake');
        console[diagnostic.level](diagnostic.message);
        settleRejected(new Error(`WebSocket 在握手期关闭: code=${close.code}`));
        this.handlers.onClose?.(close);
      });

      this.ws.addEventListener('message', ev => this.handleMessage(ev as { data: unknown }));
    });
  }

  sendEvent(event: string, payload?: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== TRAIN_V2_SOCKET_STATE.OPEN) {
      console.warn('[pro-ws] sendEvent skipped, ws not open', event);
      return;
    }
    // 对齐脚本 send_json：无 payload 时不携带该字段
    this.ws.send(JSON.stringify(payload === undefined ? { event } : { event, payload }));
  }

  close(code = 1000, reason = 'client close'): void {
    this.stopHeartbeat();
    if (this.ws && this.ws.readyState !== TRAIN_V2_SOCKET_STATE.CLOSED) {
      try {
        this.ws.close(code, reason);
      } catch {
        // ignore
      }
    }
    this.ws = null;
  }

  get readyState(): number {
    return this.ws?.readyState ?? TRAIN_V2_SOCKET_STATE.CLOSED;
  }

  get activitySeq(): number {
    return this.activityCounter;
  }

  private handleMessage(ev: { data: unknown }): void {
    this.activityCounter += 1;
    if (typeof ev.data !== 'string') {
      // TTS MP3 音频帧：本期决策为不播放、直接丢弃（仅计入活动序号）
      return;
    }
    dispatchTrainV2Message(this.handlers, ev.data);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    const abort = new AbortController();
    this.heartbeatAbort = abort;
    void this.runHeartbeatLoop(abort.signal);
  }

  // 心跳计时走防节流 sleep：页面隐藏后 setInterval 会被 Chrome 节流到 1 次/分钟，
  // 心跳间隔被拉长会让服务端判定连接超时而断连
  private async runHeartbeatLoop(signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      await this.sleep(HEARTBEAT_INTERVAL_MS, signal);
      if (signal.aborted || !this.ws || this.ws.readyState !== TRAIN_V2_SOCKET_STATE.OPEN) {
        return;
      }
      this.sendEvent('heartBeat', {});
    }
  }

  private stopHeartbeat(): void {
    this.heartbeatAbort?.abort();
    this.heartbeatAbort = null;
  }
}

export { TrainV2Client, buildTrainV2CloseDiagnostic, dispatchTrainV2Message, TRAIN_V2_WS_BASE, HEARTBEAT_INTERVAL_MS };
export type {
  TrainV2Handlers,
  TrainV2ConnectionPhase,
  TrainV2ConnectedPayload,
  TrainV2DiagnosticLevel,
  TrainV2NextStepPayload,
  TrainV2SelectRoleEndPayload,
  TrainV2BotAnswerEndPayload,
  TrainV2CloseInfo,
};
