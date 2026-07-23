/**
 * Polymas AI Tools 训练流 WebSocket 客户端
 * 对齐 auto_audio_train.py 的 TrainingClient.connect / listen_loop / send_json
 */

import { throttleSafeSleep } from '../timing/throttle-safe-sleep';

interface ConnectedPayload {
  sessionId: string;
  stepId: string;
  stepName: string;
}

interface BotAnswerPayload {
  msg: string;
  historyId?: string;
}

interface UserTextPayload {
  text: string;
}

interface StepEndPayload {
  nextStepId?: string;
  stepName?: string;
  nextStepName?: string;
  endType?: string;
  stepDescription?: string;
}

interface TrainingWsHandlers {
  onConnected?(p: ConnectedPayload): void;
  onBotAnswerStart?(): void;
  onBotAnswer?(p: BotAnswerPayload): void;
  onBotAnswerEnd?(): void;
  onUserTextStart?(): void;
  onUserText?(p: UserTextPayload): void;
  onUserTextEnd?(p: UserTextPayload): void;
  onUserAudioEnd?(): void;
  onStepEnd?(p: StepEndPayload): void;
  onScriptEnd?(): void;
  onTaskEnd?(): void;
  onError?(payload: unknown): void;
  onOpen?(): void;
  onClose?(ev: CloseEvent): void;
  onUnknownEvent?(event: string, payload: unknown): void;
  /** 任何服务端事件到达都会触发，用于“无响应重发”的活动监测 */
  onServerActivity?(event: string): void;
}

const WS_BASE = 'wss://cloudapi.polymas.com/ai-tools/ws/v2/trainFlow';
// 浏览器 WebSocket 发不了协议层 ping（auto_audio_train.py 有 ping_interval=20 兜底），用更短的应用层心跳补偿
const HEARTBEAT_INTERVAL_MS = 20_000;
const OPEN_TIMEOUT_MS = 10_000;

class TrainingWsClient {
  private readonly taskId: string;
  private readonly handlers: TrainingWsHandlers;
  private ws: WebSocket | null = null;
  private heartbeatActive = false;
  // 对齐 auto_audio_train.py 的 _ws_send_lock：音频帧发送期间不得插入 heartBeat 等文本帧，
  // 否则服务端会把音频流提前收束（用户输入被截断）甚至丢会话
  private audioSending = false;
  private heartbeatPending = false;

  constructor(taskId: string, handlers: TrainingWsHandlers) {
    this.taskId = taskId;
    this.handlers = handlers;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `${WS_BASE}?taskId=${encodeURIComponent(this.taskId)}`;
      let settled = false;
      try {
        this.ws = new WebSocket(url);
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
        console.warn('[voice-ws] error', event);
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

  sendEvent(event: string, payload: Record<string, unknown> = {}): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[voice-ws] sendEvent skipped, ws not open', event);
      return;
    }
    this.ws.send(JSON.stringify({ event, payload }));
  }

  sendBinary(frame: Uint8Array): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    this.ws.send(frame);
    return true;
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

  get isAudioSending(): boolean {
    return this.audioSending;
  }

  beginAudioSend(): void {
    this.audioSending = true;
  }

  endAudioSend(): void {
    this.audioSending = false;
    if (this.heartbeatPending) {
      this.heartbeatPending = false;
      this.sendEvent('heartBeat', {});
    }
  }

  private handleMessage(ev: MessageEvent): void {
    if (typeof ev.data !== 'string') {
      // 协议中服务端不发送二进制
      return;
    }
    let parsed: { event?: string; payload?: unknown };
    try {
      parsed = JSON.parse(ev.data);
    } catch {
      return;
    }
    const event = parsed.event ?? '';
    const payload = parsed.payload ?? {};
    if (event) {
      this.handlers.onServerActivity?.(event);
    }
    switch (event) {
      case 'connected':
        this.handlers.onConnected?.(payload as ConnectedPayload);
        break;
      case 'botAnswerStart':
        this.handlers.onBotAnswerStart?.();
        break;
      case 'botAnswer':
        this.handlers.onBotAnswer?.(payload as BotAnswerPayload);
        break;
      case 'botAnswerEnd':
        this.handlers.onBotAnswerEnd?.();
        break;
      case 'userTextStart':
        this.handlers.onUserTextStart?.();
        break;
      case 'userText':
        this.handlers.onUserText?.(payload as UserTextPayload);
        break;
      case 'userTextEnd':
        this.handlers.onUserTextEnd?.(payload as UserTextPayload);
        break;
      case 'userAudioEnd':
        this.handlers.onUserAudioEnd?.();
        break;
      case 'stepEnd':
        this.handlers.onStepEnd?.(payload as StepEndPayload);
        break;
      case 'scriptEnd':
        this.handlers.onScriptEnd?.();
        break;
      case 'taskEnd':
        this.handlers.onTaskEnd?.();
        break;
      case 'error':
        this.handlers.onError?.(payload);
        break;
      default:
        this.handlers.onUnknownEvent?.(event, payload);
        break;
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatActive) {
      return;
    }
    this.heartbeatActive = true;
    void this.runHeartbeatLoop();
  }

  // 心跳计时同样走防节流 sleep：页面隐藏后 setInterval 会被节流到 1 次/分钟，
  // 心跳间隔被拉长可能导致服务端判定超时断连
  private async runHeartbeatLoop(): Promise<void> {
    while (this.heartbeatActive) {
      await throttleSafeSleep(HEARTBEAT_INTERVAL_MS);
      if (!this.heartbeatActive || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return;
      }
      if (this.audioSending) {
        this.heartbeatPending = true;
        console.log('[voice-ws] heartBeat deferred: audio frames in flight');
        continue;
      }
      this.sendEvent('heartBeat', {});
    }
  }

  private stopHeartbeat(): void {
    this.heartbeatActive = false;
    this.heartbeatPending = false;
  }
}

export { TrainingWsClient, WS_BASE };
export type { TrainingWsHandlers, ConnectedPayload, BotAnswerPayload, UserTextPayload, StepEndPayload };
