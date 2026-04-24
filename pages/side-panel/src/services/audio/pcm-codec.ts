/**
 * 浏览器端音频解码工具：MP3/WAV/OPUS → 16kHz 单声道 Int16 PCM
 * 对齐 auto_audio_train.py 的 AudioProcessor 行为
 */

const TARGET_SAMPLE_RATE = 16000;
const TARGET_CHANNELS = 1;

let sharedAudioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext => {
  if (!sharedAudioContext) {
    const Ctor: typeof AudioContext | undefined =
      typeof AudioContext !== 'undefined'
        ? AudioContext
        : ((globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ?? undefined);
    if (!Ctor) {
      throw new Error('AudioContext 不可用，当前浏览器不支持 Web Audio API');
    }
    sharedAudioContext = new Ctor();
  }
  return sharedAudioContext;
};

const downmixToMono = (buffer: AudioBuffer): Float32Array => {
  if (buffer.numberOfChannels === 1) {
    return buffer.getChannelData(0).slice();
  }
  const length = buffer.length;
  const mixed = new Float32Array(length);
  const channels = buffer.numberOfChannels;
  for (let ch = 0; ch < channels; ch += 1) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i += 1) {
      mixed[i] += data[i];
    }
  }
  for (let i = 0; i < length; i += 1) {
    mixed[i] /= channels;
  }
  return mixed;
};

const resampleTo16k = async (mono: Float32Array, sourceSampleRate: number): Promise<Float32Array> => {
  if (sourceSampleRate === TARGET_SAMPLE_RATE) {
    return mono;
  }

  const targetLength = Math.max(1, Math.ceil((mono.length * TARGET_SAMPLE_RATE) / sourceSampleRate));
  const offline = new OfflineAudioContext(TARGET_CHANNELS, targetLength, TARGET_SAMPLE_RATE);
  const sourceBuffer = offline.createBuffer(1, mono.length, sourceSampleRate);
  const channel = sourceBuffer.getChannelData(0);
  channel.set(mono);
  const node = offline.createBufferSource();
  node.buffer = sourceBuffer;
  node.connect(offline.destination);
  node.start(0);
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0).slice();
};

const float32ToInt16 = (input: Float32Array): Int16Array => {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, input[i]));
    out[i] = clamped < 0 ? Math.round(clamped * 0x8000) : Math.round(clamped * 0x7fff);
  }
  return out;
};

/**
 * 把 TTS 返回的 MP3（或其他被 Web Audio 支持的编码）解码为 16kHz 单声道 Int16 PCM。
 */
const mp3ToPcm16k = async (bytes: ArrayBuffer): Promise<Int16Array> => {
  if (!bytes || bytes.byteLength === 0) {
    throw new Error('MP3 数据为空，无法解码');
  }
  const ctx = getAudioContext();
  // decodeAudioData 会消费/detach 传入 buffer，这里复制一份避免副作用
  const copy = bytes.slice(0);
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(copy);
  } catch (error) {
    throw new Error(`MP3 解码失败（${bytes.byteLength} 字节）: ${(error as Error).message}`);
  }
  const mono = downmixToMono(decoded);
  const resampled = await resampleTo16k(mono, decoded.sampleRate);
  return float32ToInt16(resampled);
};

/**
 * 预留 WAV 分支：RIFF 头 44B，后续为 Int16 PCM。当 response_format=wav 且采样率/通道符合时直接裁剪；
 * 否则走 decodeAudioData 路径（Web Audio 支持 WAV）。
 */
const wavToPcm16k = async (bytes: ArrayBuffer): Promise<Int16Array> => mp3ToPcm16k(bytes);

export { mp3ToPcm16k, wavToPcm16k, TARGET_SAMPLE_RATE };
