/**
 * 音频帧组装：对齐 auto_audio_train.py 的 AudioProcessor.create_frame
 * 协议格式：8 字节固定头 + 3200 字节 PCM（不足补零）
 */

const FRAME_HEADER = new Uint8Array([0x11, 0x20, 0x10, 0x00, 0x00, 0x00, 0x0c, 0x80]);
const PCM_CHUNK_SIZE = 3200;
const FRAME_SIZE = FRAME_HEADER.length + PCM_CHUNK_SIZE;
const SILENCE_TAIL_COUNT = 15;

const buildFrame = (pcmChunkBytes: Uint8Array): Uint8Array => {
  const frame = new Uint8Array(FRAME_SIZE);
  frame.set(FRAME_HEADER, 0);
  const copyLength = Math.min(pcmChunkBytes.length, PCM_CHUNK_SIZE);
  if (copyLength > 0) {
    frame.set(pcmChunkBytes.subarray(0, copyLength), FRAME_HEADER.length);
  }
  // 剩余位自动为 0，即静音填充
  return frame;
};

const buildSilenceFrame = (): Uint8Array => buildFrame(new Uint8Array(0));

/**
 * 将 Int16Array PCM 切分为音频帧序列。
 * 每帧包含 3200 字节（1600 个 Int16 样本，16kHz 下为 100ms）。
 */
const buildAudioFrames = (pcm: Int16Array): Uint8Array[] => {
  if (pcm.length === 0) {
    return [];
  }
  // 把 Int16 视图转为底层字节视图，避免额外复制
  const pcmBytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const frames: Uint8Array[] = [];
  for (let offset = 0; offset < pcmBytes.length; offset += PCM_CHUNK_SIZE) {
    frames.push(buildFrame(pcmBytes.subarray(offset, offset + PCM_CHUNK_SIZE)));
  }
  return frames;
};

export { FRAME_HEADER, PCM_CHUNK_SIZE, FRAME_SIZE, SILENCE_TAIL_COUNT, buildAudioFrames, buildSilenceFrame };
