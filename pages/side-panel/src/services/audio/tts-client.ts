/**
 * TTS 合成客户端：直接 fetch Polymas TTS（response 可能是二进制或 SSE）
 * 不走 apiRequest（避免响应被按 JSON 解析导致二进制损坏）
 */

import { llmConfigStorage, normalizeLLMConfig } from '@extension/storage';

interface TTSSynthesizeOptions {
  signal?: AbortSignal;
}

interface TTSSynthesizeResult {
  bytes: ArrayBuffer;
  contentType: string;
}

const MAX_RETRIES = 1;

const decodeBase64ToBytes = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const concatUint8Arrays = (chunks: Uint8Array[]): ArrayBuffer => {
  const total = chunks.reduce((sum, c) => sum + c.byteLength, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged.buffer.slice(0);
};

const parseSseAudioFrames = (text: string): ArrayBuffer => {
  const chunks: Uint8Array[] = [];
  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    if (!rawLine.startsWith('data:')) {
      continue;
    }
    const payload = rawLine.slice(5).trim();
    if (!payload) {
      continue;
    }
    try {
      const parsed = JSON.parse(payload) as { audioFrame?: string };
      if (parsed.audioFrame) {
        chunks.push(decodeBase64ToBytes(parsed.audioFrame));
      }
    } catch {
      // 单行解析失败不影响后续帧
    }
  }
  if (chunks.length === 0) {
    throw new Error('SSE 响应中未找到任何 audioFrame');
  }
  return concatUint8Arrays(chunks);
};

const fetchTtsOnce = async (text: string, opts?: TTSSynthesizeOptions): Promise<TTSSynthesizeResult> => {
  const config = normalizeLLMConfig(await llmConfigStorage.get());
  if (!config.apiKey.trim()) {
    throw new Error('请先在设置里配置 LLM API Key，TTS 将复用同一个 Key');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'api-key': config.apiKey,
  };
  if (config.serviceCode.trim()) {
    headers['service-code'] = config.serviceCode;
  }

  const body = JSON.stringify({
    model: config.ttsModel,
    input: text,
    voice: config.voice,
    speed: config.speed,
    response_format: config.ttsResponseFormat,
  });

  const response = await fetch(config.ttsApiUrl, {
    method: 'POST',
    headers,
    body,
    signal: opts?.signal,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`TTS 请求失败 ${response.status}${errText ? `: ${errText.slice(0, 200)}` : ''}`);
  }

  const contentType = (response.headers.get('Content-Type') ?? '').toLowerCase();
  if (contentType.includes('text/event-stream')) {
    const raw = await response.text();
    return { bytes: parseSseAudioFrames(raw), contentType };
  }

  const bytes = await response.arrayBuffer();
  if (bytes.byteLength === 0) {
    throw new Error('TTS 返回空音频');
  }
  return { bytes, contentType };
};

const synthesizeTTS = async (text: string, opts?: TTSSynthesizeOptions): Promise<ArrayBuffer> => {
  if (!text || !text.trim()) {
    throw new Error('TTS 输入文本为空');
  }

  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const { bytes } = await fetchTtsOnce(text, opts);
      return bytes;
    } catch (error) {
      lastError = error;
      if ((error as { name?: string }).name === 'AbortError') {
        throw error;
      }
      // 非最后一次才重试
      if (attempt >= MAX_RETRIES) {
        break;
      }
    }
  }
  throw new Error(`TTS 合成失败: ${(lastError as Error).message}`);
};

export { synthesizeTTS };
export type { TTSSynthesizeOptions };
