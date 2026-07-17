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
        const phase = settled ? 'connected' : 'handshake';
        if (!settled) {
          settled = true;
          clearTimeout(openTimer);
          reject(new Error('WebSocket 连接失败'));
        }
        // 浏览器 error 事件不透明（无细节）；真正原因看紧随其后的 [pro-ws] close code，
        // 以及 DevTools Network 面板里该 trainV2 请求的握手 HTTP 状态（200/401 等 JS 无法读取）。
        console.warn(`[pro-ws] error (phase=${phase}, 细节不透明，见下方 close code 与 Network 握手状态)`, event);
      });

      this.ws.addEventListener('close', ev => {
        this.stopHeartbeat();
        // close code 是握手/连接失败的关键诊断信号（1006=服务器在建立前就断，典型握手被拒）。
        // 始终打印：error 先触发会把 settled 置真，此前该 code 被 if(!settled) 挡掉、无处可见。
        console.warn(
          `[pro-ws] close code=${ev.code} reason=${ev.reason || '(空)'} wasClean=${ev.wasClean} phase=${settled ? 'connected' : 'handshake'}`,
        );
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
