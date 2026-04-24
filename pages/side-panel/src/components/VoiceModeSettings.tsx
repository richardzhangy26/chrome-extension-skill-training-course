/**
 * 语音训练（TTS）配置区块
 * 作为 SettingsModal 的一个 Tab 呈现，共享 draft / Save 生命周期。
 */
import {
  DEFAULT_TTS_API_URL,
  DEFAULT_TTS_MODEL,
  DEFAULT_VOICE,
  DEFAULT_SPEED,
  DEFAULT_TTS_RESPONSE_FORMAT,
  SUPPORTED_TTS_RESPONSE_FORMATS,
  SPEED_MIN,
  SPEED_MAX,
} from '@extension/storage';
import type { LLMConfig, TTSResponseFormat } from '@extension/storage';
import type { Dispatch, SetStateAction } from 'react';

// 与 SettingsModal 的 LLMConfigDraft 字段兼容——TTS 字段没有 string 化
type DraftLike = Omit<LLMConfig, 'temperature' | 'topK' | 'maxTokens' | 'maxHistoryRounds'> & {
  temperature: string;
  topK: string;
  maxTokens: string;
  maxHistoryRounds: string;
};

interface VoiceModeSettingsProps {
  config: DraftLike;
  setConfig: Dispatch<SetStateAction<DraftLike>>;
}

// Polymas 代理 + cosyvoice-v1 下可用的音色分组
interface VoiceOption {
  value: string;
  label: string;
}

const CHINESE_VOICES: VoiceOption[] = [
  { value: 'longxiaochun', label: 'longxiaochun · 甜美女声' },
  { value: 'longxiaoxia', label: 'longxiaoxia · 温柔女声' },
  { value: 'longyuan', label: 'longyuan · 成熟女声' },
  { value: 'longyue', label: 'longyue · 清新女声' },
];

const ENGLISH_VOICES: VoiceOption[] = [{ value: 'loongstella', label: 'loongstella · 英文女声' }];

const ALL_PRESET_VOICES: VoiceOption[] = [...CHINESE_VOICES, ...ENGLISH_VOICES];

const CUSTOM_VOICE_SENTINEL = '__custom__';

const VoiceModeSettings = ({ config, setConfig }: VoiceModeSettingsProps) => {
  const update = <K extends keyof DraftLike>(key: K, value: DraftLike[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const speedNumber = typeof config.speed === 'number' && Number.isFinite(config.speed) ? config.speed : DEFAULT_SPEED;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-800">语音训练（TTS）</h3>
        <p className="mt-1 text-xs text-slate-500">
          口语训练模式下，用户文字会先通过 TTS 合成音频再推送给平台。API Key / service-code 与上方
          大模型配置共享，无需重复填写。
        </p>

        <div className="mt-4 space-y-4">
          <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={config.voiceModeEnabled}
              onChange={e => update('voiceModeEnabled', e.target.checked)}
            />
            <span>
              默认以语音模式启动
              <span className="block text-xs text-slate-400">
                勾选后，下次打开侧边栏将自动切到语音训练；可随时用 Header 按钮切回文字。
              </span>
            </span>
          </label>

          <div>
            <label htmlFor="ttsApiUrl" className="mb-1.5 block text-sm font-medium text-slate-700">
              TTS API URL
            </label>
            <input
              id="ttsApiUrl"
              type="text"
              value={config.ttsApiUrl}
              placeholder={DEFAULT_TTS_API_URL}
              onChange={e => update('ttsApiUrl', e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm transition-all focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100"
            />
            <p className="mt-1 text-xs text-slate-400">默认使用 Polymas 同域 TTS。留空会自动回落到默认值。</p>
          </div>

          <div>
            <label htmlFor="ttsModel" className="mb-1.5 block text-sm font-medium text-slate-700">
              TTS 模型
            </label>
            <input
              id="ttsModel"
              type="text"
              value={config.ttsModel}
              placeholder={DEFAULT_TTS_MODEL}
              onChange={e => update('ttsModel', e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm transition-all focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100"
            />
          </div>

          <div>
            <label htmlFor="voicePreset" className="mb-1.5 block text-sm font-medium text-slate-700">
              音色 (voice)
            </label>
            <select
              id="voicePreset"
              value={ALL_PRESET_VOICES.some(v => v.value === config.voice) ? config.voice : CUSTOM_VOICE_SENTINEL}
              onChange={e => {
                const next = e.target.value;
                if (next === CUSTOM_VOICE_SENTINEL) {
                  return;
                }
                update('voice', next);
              }}
              className="w-full cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm transition-all focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100">
              <option value={CUSTOM_VOICE_SENTINEL}>
                {ALL_PRESET_VOICES.some(v => v.value === config.voice)
                  ? '选择预设音色'
                  : `自定义：${config.voice || DEFAULT_VOICE}`}
              </option>
              <optgroup label="中文音色">
                {CHINESE_VOICES.map(v => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="英文音色">
                {ENGLISH_VOICES.map(v => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </optgroup>
            </select>
            <input
              id="voice"
              type="text"
              value={config.voice}
              placeholder={DEFAULT_VOICE}
              onChange={e => update('voice', e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm transition-all focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100"
            />
            <p className="mt-1 text-xs text-slate-400">
              下拉选择预设音色；也可以直接输入自定义 voice ID（与 TTS 模型匹配）。
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ttsSpeed" className="mb-1.5 block text-sm font-medium text-slate-700">
                语速 ({speedNumber.toFixed(2)})
              </label>
              <input
                id="ttsSpeed"
                type="range"
                min={SPEED_MIN}
                max={SPEED_MAX}
                step={0.05}
                value={speedNumber}
                onChange={e => update('speed', Number(e.target.value))}
                className="w-full"
              />
              <p className="mt-1 text-xs text-slate-400">
                范围 {SPEED_MIN.toFixed(2)}–{SPEED_MAX.toFixed(2)}，默认 {DEFAULT_SPEED.toFixed(2)}。
              </p>
            </div>
            <div>
              <label htmlFor="ttsResponseFormat" className="mb-1.5 block text-sm font-medium text-slate-700">
                音频格式
              </label>
              <select
                id="ttsResponseFormat"
                value={config.ttsResponseFormat}
                onChange={e => update('ttsResponseFormat', e.target.value as TTSResponseFormat)}
                className="w-full cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm transition-all focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100">
                {SUPPORTED_TTS_RESPONSE_FORMATS.map(fmt => (
                  <option key={fmt} value={fmt}>
                    {fmt}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-400">默认 {DEFAULT_TTS_RESPONSE_FORMAT}，推荐保持默认。</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export { VoiceModeSettings };
