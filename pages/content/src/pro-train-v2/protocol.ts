const PROTOCOL = 'polymas-pro-train-v2' as const;
const VERSION = 1 as const;
const PRO_TRAIN_V2_PORT_NAME = 'polymas-pro-train-v2' as const;
const TRAIN_V2_BASE = 'wss://cloudapi.polymas.com/ai-platform/ws/trainV2';
const MAX_CONNECTION_ID_LENGTH = 256;
const MAX_CLOSE_REASON_LENGTH = 123;
const ALLOWED_TRAIN_V2_EVENTS = new Set([
  'scriptStart',
  'stepStart',
  'userTextInput',
  'continueCurrentStep',
  'heartBeat',
]);

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

type TrainV2ConnectionParams = { taskId: string; userId: string; sessionId: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasOnlyKeys = (value: Record<string, unknown>, allowedKeys: string[]): boolean =>
  Object.keys(value).every(key => allowedKeys.includes(key));

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const isProTaskId = (value: unknown): value is string => isNonEmptyString(value) && /^PRO[A-Za-z0-9_-]+$/.test(value);

const isConnectionId = (value: unknown): value is string =>
  isNonEmptyString(value) && value.length <= MAX_CONNECTION_ID_LENGTH && /^[A-Za-z0-9_-]+$/.test(value);

const isEnvelope = (
  value: unknown,
  direction: 'extension-to-page' | 'page-to-extension',
): value is Record<string, unknown> =>
  isRecord(value) &&
  hasOnlyKeys(value, ['protocol', 'version', 'direction', 'connectionId', 'type', 'payload']) &&
  value.protocol === PROTOCOL &&
  value.version === VERSION &&
  value.direction === direction &&
  isConnectionId(value.connectionId) &&
  isNonEmptyString(value.type);

const isCloseReason = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= MAX_CLOSE_REASON_LENGTH;

const isCloseCommandCode = (value: unknown): value is number =>
  isFiniteNumber(value) && Number.isInteger(value) && (value === 1000 || (value >= 3000 && value <= 4999));

const isCloseEventCode = (value: unknown): value is number =>
  isFiniteNumber(value) && Number.isInteger(value) && value >= 0 && value <= 4999;

const isAllowedTrainV2Payload = (data: unknown): data is string => {
  if (typeof data !== 'string') return false;

  let message: unknown;
  try {
    message = JSON.parse(data);
  } catch {
    return false;
  }
  if (
    !isRecord(message) ||
    !hasOnlyKeys(message, ['event', 'payload']) ||
    !isNonEmptyString(message.event) ||
    !ALLOWED_TRAIN_V2_EVENTS.has(message.event)
  ) {
    return false;
  }

  switch (message.event) {
    case 'scriptStart':
    case 'continueCurrentStep':
      return message.payload === undefined;
    case 'stepStart':
      return (
        isRecord(message.payload) &&
        hasOnlyKeys(message.payload, ['stepId']) &&
        isNonEmptyString(message.payload.stepId)
      );
    case 'userTextInput':
      return (
        isRecord(message.payload) && hasOnlyKeys(message.payload, ['text']) && isNonEmptyString(message.payload.text)
      );
    case 'heartBeat':
      return message.payload === undefined || (isRecord(message.payload) && Object.keys(message.payload).length === 0);
    default:
      return false;
  }
};

const isProTrainV2Command = (value: unknown): value is ProTrainV2Command => {
  if (!isEnvelope(value, 'extension-to-page')) return false;

  switch (value.type) {
    case 'CONNECT':
      return (
        isRecord(value.payload) &&
        hasOnlyKeys(value.payload, ['taskId', 'userId', 'sessionId']) &&
        isProTaskId(value.payload.taskId) &&
        isNonEmptyString(value.payload.userId) &&
        isNonEmptyString(value.payload.sessionId)
      );
    case 'SEND':
      return (
        isRecord(value.payload) && hasOnlyKeys(value.payload, ['data']) && isAllowedTrainV2Payload(value.payload.data)
      );
    case 'CLOSE':
      return (
        isRecord(value.payload) &&
        hasOnlyKeys(value.payload, ['code', 'reason']) &&
        isCloseCommandCode(value.payload.code) &&
        isCloseReason(value.payload.reason)
      );
    default:
      return false;
  }
};

const isProTrainV2PageEvent = (value: unknown): value is ProTrainV2PageEvent => {
  if (!isEnvelope(value, 'page-to-extension')) return false;

  switch (value.type) {
    case 'OPEN':
    case 'ERROR':
      return value.payload === undefined;
    case 'TEXT':
      return isRecord(value.payload) && hasOnlyKeys(value.payload, ['data']) && typeof value.payload.data === 'string';
    case 'BINARY':
      return (
        isRecord(value.payload) &&
        hasOnlyKeys(value.payload, ['byteLength']) &&
        isFiniteNumber(value.payload.byteLength) &&
        Number.isInteger(value.payload.byteLength) &&
        value.payload.byteLength >= 0
      );
    case 'CLOSE':
      return (
        isRecord(value.payload) &&
        hasOnlyKeys(value.payload, ['code', 'reason', 'wasClean']) &&
        isCloseEventCode(value.payload.code) &&
        isCloseReason(value.payload.reason) &&
        typeof value.payload.wasClean === 'boolean'
      );
    default:
      return false;
  }
};

const buildTrainV2Url = ({ taskId, userId, sessionId }: TrainV2ConnectionParams): string => {
  const query = new URLSearchParams({ taskId, userId, sessionId });
  return `${TRAIN_V2_BASE}?${query.toString()}`;
};

const readTaskIdFromPageUrl = (pageUrl: string): string | null => {
  try {
    const url = new URL(pageUrl);
    const taskId = url.searchParams.get('trainTaskId') ?? url.searchParams.get('taskId');
    return isProTaskId(taskId) ? taskId : null;
  } catch {
    return null;
  }
};

export {
  PROTOCOL,
  VERSION,
  PRO_TRAIN_V2_PORT_NAME,
  TRAIN_V2_BASE,
  buildTrainV2Url,
  isAllowedTrainV2Payload,
  isProTrainV2Command,
  isProTrainV2PageEvent,
  readTaskIdFromPageUrl,
};
export type { ProTrainV2Command, ProTrainV2PageEvent, TrainV2ConnectionParams };
