/**
 * LLM 设置弹窗组件
 */

import { ModelSelector } from './ModelSelector';
import { VoiceModeSettings } from './VoiceModeSettings';
import { fetchAvailableTextModels, testLLMConfig } from '../services/llm-service';
import {
  AVAILABLE_MODELS,
  DEFAULT_LLM_MAX_HISTORY_ROUNDS,
  DEFAULT_LLM_MAX_TOKENS,
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_TEMPERATURE,
  DEFAULT_LLM_TOP_K,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_PROFILE_ID,
  DEFAULT_STUDENT_PROFILES,
  DEFAULT_TTS_API_URL,
  DEFAULT_TTS_MODEL,
  DEFAULT_VOICE,
  DEFAULT_SPEED,
  DEFAULT_TTS_RESPONSE_FORMAT,
  llmConfigStorage,
  normalizeLLMConfig,
} from '@extension/storage';
import { useCallback, useEffect, useState } from 'react';
import type { ModelOption } from './ModelSelector';
import type { StudentProfile, LLMConfig } from '@extension/storage';

// 关闭图标
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// 设置图标
const SettingsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
);

const createProfileId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `profile-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface LLMConfigDraft extends Omit<LLMConfig, 'temperature' | 'topK' | 'maxTokens' | 'maxHistoryRounds'> {
  temperature: string;
  topK: string;
  maxTokens: string;
  maxHistoryRounds: string;
}

const DEFAULT_MODEL_OPTIONS: ModelOption[] = AVAILABLE_MODELS.map(model => ({ ...model }));

const createDefaultConfig = (): LLMConfig => ({
  apiKey: '',
  apiUrl: 'http://llm-service.polymas.com/api/openai/v1/chat/completions',
  model: DEFAULT_LLM_MODEL,
  temperature: DEFAULT_LLM_TEMPERATURE,
  topK: DEFAULT_LLM_TOP_K,
  maxTokens: DEFAULT_LLM_MAX_TOKENS,
  maxHistoryRounds: DEFAULT_LLM_MAX_HISTORY_ROUNDS,
  serviceCode: 'SI_Ability',
  enabled: false,
  systemPromptMode: 'default',
  systemPrompt: '',
  studentProfileId: DEFAULT_PROFILE_ID,
  studentProfiles: DEFAULT_STUDENT_PROFILES,
  dialogueSimulationEnabled: false,
  dialogueSimulationContent: '',
  knowledgeBaseEnabled: false,
  knowledgeBaseContent: '',
  voiceModeEnabled: false,
  ttsApiUrl: DEFAULT_TTS_API_URL,
  ttsModel: DEFAULT_TTS_MODEL,
  voice: DEFAULT_VOICE,
  speed: DEFAULT_SPEED,
  ttsResponseFormat: DEFAULT_TTS_RESPONSE_FORMAT,
});

const createConfigDraft = (config: LLMConfig): LLMConfigDraft => ({
  ...config,
  temperature: String(config.temperature),
  topK: String(config.topK),
  maxTokens: String(config.maxTokens),
  maxHistoryRounds: String(config.maxHistoryRounds),
});

const normalizeDraftConfig = (config: LLMConfigDraft) =>
  normalizeLLMConfig({
    ...config,
    temperature: config.temperature,
    topK: config.topK,
    maxTokens: config.maxTokens,
    maxHistoryRounds: config.maxHistoryRounds,
  });

const createConnectionSignature = (config: LLMConfig) =>
  JSON.stringify({
    apiKey: config.apiKey,
    apiUrl: config.apiUrl,
    serviceCode: config.serviceCode,
    model: config.model,
    temperature: config.temperature,
    topK: config.topK,
    maxTokens: config.maxTokens,
  });

const createModelOption = (value: string): ModelOption => ({
  value,
  label: AVAILABLE_MODELS.find(model => model.value === value)?.label ?? value,
});

const SettingsModal = ({ isOpen, onClose }: SettingsModalProps) => {
  const [config, setConfig] = useState<LLMConfigDraft>(() => createConfigDraft(createDefaultConfig()));
  const [activeTab, setActiveTab] = useState<'llm' | 'system' | 'role' | 'voice'>('llm');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [testedConnectionSignature, setTestedConnectionSignature] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<ModelOption[]>(DEFAULT_MODEL_OPTIONS);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const loadAvailableModels = useCallback(async (nextConfig: LLMConfig) => {
    setIsLoadingModels(true);
    setModelsError(null);

    try {
      const models = await fetchAvailableTextModels(nextConfig);

      if (models.length === 0) {
        setAvailableModels(DEFAULT_MODEL_OPTIONS);
        setModelsError('当前接口没有返回可用的文本模型，已回退到默认候选。');
        return;
      }

      setAvailableModels(models.map(createModelOption));
    } catch (error) {
      setAvailableModels(DEFAULT_MODEL_OPTIONS);
      setModelsError((error as Error).message);
    } finally {
      setIsLoadingModels(false);
    }
  }, []);

  // 加载配置
  useEffect(() => {
    if (isOpen) {
      llmConfigStorage.get().then(loadedConfig => {
        const normalizedConfig = normalizeLLMConfig(loadedConfig);
        setConfig(createConfigDraft(normalizedConfig));
        setTestedConnectionSignature(createConnectionSignature(normalizedConfig));
        setAvailableModels(DEFAULT_MODEL_OPTIONS);
        setModelsError(null);
        setTestResult(null);
        setActiveTab('llm');
        void loadAvailableModels(normalizedConfig);
      });
    }
  }, [isOpen, loadAvailableModels]);

  const normalizedConfig = normalizeDraftConfig(config);
  const currentConnectionSignature = createConnectionSignature(normalizedConfig);
  const requiresRetest = currentConnectionSignature !== testedConnectionSignature;
  const canSave = !requiresRetest;

  useEffect(() => {
    if (testResult && requiresRetest) {
      setTestResult(null);
    }
  }, [requiresRetest, testResult]);

  // 测试配置
  const handleTest = async () => {
    const nextConfig = normalizeDraftConfig(config);

    setConfig(createConfigDraft(nextConfig));

    if (!nextConfig.apiKey.trim()) {
      setTestResult({ success: false, message: '请先输入 API Key' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    const result = await testLLMConfig(nextConfig);
    setTestResult({
      success: result.success,
      message: result.success ? '✅ 连接成功！' : `❌ ${result.error}`,
    });

    if (result.success) {
      setTestedConnectionSignature(createConnectionSignature(nextConfig));
      void loadAvailableModels(nextConfig);
    }

    setIsTesting(false);
  };

  // 保存配置
  const handleSave = async () => {
    const nextConfig = normalizeDraftConfig(config);

    if (createConnectionSignature(nextConfig) !== testedConnectionSignature) {
      setTestResult({ success: false, message: '❌ 连接参数已变更，请先测试连接并通过后再保存' });
      return;
    }

    setIsSaving(true);
    await llmConfigStorage.setConfig({
      ...nextConfig,
      enabled: nextConfig.apiKey.trim().length > 0,
    });
    setConfig(createConfigDraft(nextConfig));
    setIsSaving(false);
    onClose();
  };

  if (!isOpen) return null;

  const studentProfileEntries = config.studentProfiles ?? DEFAULT_STUDENT_PROFILES;
  const systemPromptValue = config.systemPromptMode === 'custom' ? config.systemPrompt : DEFAULT_SYSTEM_PROMPT;

  const handleProfileChange = (id: string, patch: Partial<StudentProfile>) => {
    setConfig(prev => ({
      ...prev,
      studentProfiles: prev.studentProfiles.map(profile =>
        profile.id === id
          ? {
              ...profile,
              ...patch,
            }
          : profile,
      ),
    }));
  };

  const handleAddProfile = () => {
    const id = createProfileId();
    setConfig(prev => ({
      ...prev,
      studentProfiles: [
        ...prev.studentProfiles,
        {
          id,
          label: '新学生档位',
          description: '补充角色理解与回答习惯。',
          style: '描述表达风格或语气。',
          fallbackHint: '',
        },
      ],
      studentProfileId: prev.studentProfileId || id,
    }));
  };

  const handleDeleteProfile = (id: string) => {
    setConfig(prev => {
      if (prev.studentProfiles.length <= 1) {
        return prev;
      }

      const nextProfiles = prev.studentProfiles.filter(profile => profile.id !== id);
      const nextSelected =
        prev.studentProfileId === id ? (nextProfiles[0]?.id ?? DEFAULT_PROFILE_ID) : prev.studentProfileId;

      return {
        ...prev,
        studentProfiles: nextProfiles,
        studentProfileId: nextSelected,
      };
    });
  };

  const handleResetProfiles = () => {
    setConfig(prev => ({
      ...prev,
      studentProfiles: DEFAULT_STUDENT_PROFILES,
      studentProfileId: DEFAULT_PROFILE_ID,
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩层 */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        onKeyDown={e => e.key === 'Escape' && onClose()}
        role="button"
        tabIndex={0}
        aria-label="关闭弹窗"
      />

      {/* 弹窗内容 */}
      <div className="relative max-h-[80vh] w-[90%] max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-teal-500 to-cyan-500 px-5 py-4">
          <h2 className="text-lg font-semibold text-white">设置</h2>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1 text-white/80 transition-colors hover:bg-white/20 hover:text-white">
            <CloseIcon />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 bg-slate-50 px-5">
          <div className="flex gap-2 pt-3">
            {[
              { id: 'llm', label: '大模型自动回复' },
              { id: 'system', label: '系统提示词' },
              { id: 'role', label: '用户角色' },
              { id: 'voice', label: '语音训练' },
            ].map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as 'llm' | 'system' | 'role' | 'voice')}
                  className={`rounded-t-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-slate-200 border-b-white bg-white text-cyan-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}>
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 内容 */}
        <div className="max-h-[calc(80vh-180px)] overflow-y-auto p-5">
          {activeTab === 'llm' && (
            <div className="space-y-4">
              {/* API Key */}
              <div>
                <label htmlFor="apiKey" className="mb-1.5 block text-sm font-medium text-slate-700">
                  API Key <span className="text-red-500">*</span>
                </label>
                <input
                  id="apiKey"
                  type="password"
                  value={config.apiKey}
                  onChange={e => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                  placeholder="请输入豆包 API Key"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm transition-all focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100"
                />
                <p className="mt-1 text-xs text-slate-400">需要企业微信申请 llm-service 获取</p>
              </div>

              {/* 模型设置 */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="model" className="block text-sm font-medium text-slate-700">
                    模型
                  </label>
                  <button
                    type="button"
                    onClick={() => void loadAvailableModels(normalizedConfig)}
                    disabled={isLoadingModels}
                    className="text-xs font-medium text-cyan-600 transition-colors hover:text-cyan-700 disabled:cursor-not-allowed disabled:text-slate-300">
                    {isLoadingModels ? '刷新中...' : '刷新模型列表'}
                  </button>
                </div>
                <input
                  id="model"
                  type="text"
                  value={config.model}
                  onChange={e => setConfig(prev => ({ ...prev, model: e.target.value }))}
                  placeholder={DEFAULT_LLM_MODEL}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm transition-all focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100"
                />
                <div className="mt-2">
                  <p id="modelPresetLabel" className="mb-1 text-xs font-medium text-slate-600">
                    从动态文本模型列表中选择
                  </p>
                  <ModelSelector
                    options={availableModels}
                    value={normalizedConfig.model}
                    onChange={model => setConfig(prev => ({ ...prev, model }))}
                    labelId="modelPresetLabel"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  支持输入任意模型名；下拉框会从当前 API 动态拉取，仅显示 text 模型，当前共 {availableModels.length}
                  个候选。留空时默认使用 {DEFAULT_LLM_MODEL}。
                </p>
                {modelsError && <p className="mt-1 text-xs text-amber-600">{modelsError}</p>}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="temperature" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Temperature
                  </label>
                  <input
                    id="temperature"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.1"
                    value={config.temperature}
                    onChange={e => setConfig(prev => ({ ...prev, temperature: e.target.value }))}
                    placeholder={String(DEFAULT_LLM_TEMPERATURE)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm transition-all focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100"
                  />
                </div>
                <div>
                  <label htmlFor="topK" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Top K
                  </label>
                  <input
                    id="topK"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    step="1"
                    value={config.topK}
                    onChange={e => setConfig(prev => ({ ...prev, topK: e.target.value }))}
                    placeholder={String(DEFAULT_LLM_TOP_K)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm transition-all focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100"
                  />
                </div>
                <div>
                  <label htmlFor="maxTokens" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Max Token
                  </label>
                  <input
                    id="maxTokens"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    step="1"
                    value={config.maxTokens}
                    onChange={e => setConfig(prev => ({ ...prev, maxTokens: e.target.value }))}
                    placeholder={String(DEFAULT_LLM_MAX_TOKENS)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm transition-all focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-400">
                Temperature 控制回答随机性，越低越稳定，越高越发散；Top K 控制每次采样时参与候选的 token
                数量，越小越保守，越大越灵活；Max Token
                控制本次最多生成多少内容，越大回答越长。数值留空或非法时会自动恢复默认值：temperature{' '}
                {DEFAULT_LLM_TEMPERATURE}、topK {DEFAULT_LLM_TOP_K}、maxToken {DEFAULT_LLM_MAX_TOKENS}。
              </p>

              {/* 最大历史轮数 */}
              <div>
                <label htmlFor="maxHistoryRounds" className="mb-1.5 block text-sm font-medium text-slate-700">
                  最大历史轮数
                </label>
                <input
                  id="maxHistoryRounds"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  value={config.maxHistoryRounds}
                  onChange={e => setConfig(prev => ({ ...prev, maxHistoryRounds: e.target.value }))}
                  placeholder={String(DEFAULT_LLM_MAX_HISTORY_ROUNDS)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm transition-all focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100"
                />
                <p className="mt-1 text-xs text-slate-400">
                  发送给大模型的最大对话历史轮数，留空或非法时默认 {DEFAULT_LLM_MAX_HISTORY_ROUNDS} 轮。
                </p>
              </div>

              {/* API URL */}
              <div>
                <label htmlFor="apiUrl" className="mb-1.5 block text-sm font-medium text-slate-700">
                  API URL
                </label>
                <input
                  id="apiUrl"
                  type="text"
                  value={config.apiUrl}
                  onChange={e => setConfig(prev => ({ ...prev, apiUrl: e.target.value }))}
                  placeholder="API 地址"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm text-xs transition-all focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100"
                />
              </div>

              {/* Service Code */}
              <div>
                <label htmlFor="serviceCode" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Service Code
                </label>
                <input
                  id="serviceCode"
                  type="text"
                  value={config.serviceCode}
                  onChange={e => setConfig(prev => ({ ...prev, serviceCode: e.target.value }))}
                  placeholder="服务代码"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm transition-all focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100"
                />
              </div>

              {/* 测试结果 */}
              {testResult && (
                <div
                  className={`rounded-lg p-3 text-sm ${
                    testResult.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                  }`}>
                  {testResult.message}
                </div>
              )}

              {requiresRetest && (
                <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
                  当前连接参数已变更，请先测试连接通过后再保存配置。
                </div>
              )}
            </div>
          )}

          {activeTab === 'system' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-800">系统提示词设置</h3>
                <p className="mt-1 text-xs text-slate-500">
                  默认提示词来源于 auto_script_train.py，可切换为自定义提示词。
                </p>
                <div className="mt-3 space-y-2">
                  <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="systemPromptMode"
                      value="default"
                      checked={config.systemPromptMode === 'default'}
                      onChange={() =>
                        setConfig(prev => ({
                          ...prev,
                          systemPromptMode: 'default',
                        }))
                      }
                    />
                    <span>使用默认提示词（auto_script_train.py）</span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="systemPromptMode"
                      value="custom"
                      checked={config.systemPromptMode === 'custom'}
                      onChange={() =>
                        setConfig(prev => ({
                          ...prev,
                          systemPromptMode: 'custom',
                          systemPrompt: prev.systemPrompt.trim() ? prev.systemPrompt : DEFAULT_SYSTEM_PROMPT,
                        }))
                      }
                    />
                    <span>自定义提示词</span>
                  </label>
                </div>

                <div className="mt-3">
                  <label htmlFor="systemPrompt" className="mb-1.5 block text-xs font-medium text-slate-600">
                    提示词内容
                  </label>
                  <textarea
                    id="systemPrompt"
                    value={systemPromptValue}
                    onChange={e => setConfig(prev => ({ ...prev, systemPrompt: e.target.value }))}
                    disabled={config.systemPromptMode !== 'custom'}
                    placeholder="输入自定义系统提示词"
                    className="min-h-[140px] w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 transition-all focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    使用自定义提示词时，系统会保留角色档位配置作为补充提示。
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'role' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-800">用户角色提示词配置</h3>
                <p className="mt-1 text-xs text-slate-500">你可以自由新增、编辑学生档位，并选择默认使用的档位。</p>
                <div className="mt-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleAddProfile}
                    className="rounded-md bg-cyan-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-cyan-600">
                    添加档位
                  </button>
                  <button
                    type="button"
                    onClick={handleResetProfiles}
                    className="text-xs font-medium text-cyan-600 hover:text-cyan-700">
                    恢复默认档位
                  </button>
                </div>
                <div className="mt-3 space-y-3">
                  {studentProfileEntries.map(profile => {
                    const isSelected = config.studentProfileId === profile.id;
                    const labelId = `studentProfile-label-${profile.id}`;
                    const descriptionId = `studentProfile-description-${profile.id}`;
                    const styleId = `studentProfile-style-${profile.id}`;
                    const fallbackId = `studentProfile-fallback-${profile.id}`;
                    return (
                      <div
                        key={profile.id}
                        className={`rounded-lg border p-3 text-sm transition ${
                          isSelected
                            ? 'border-cyan-400 bg-cyan-50/60'
                            : 'border-slate-200 bg-white hover:border-cyan-200'
                        }`}>
                        <div className="flex items-center justify-between">
                          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
                            <input
                              type="radio"
                              name="studentProfile"
                              value={profile.id}
                              checked={isSelected}
                              onChange={() => setConfig(prev => ({ ...prev, studentProfileId: profile.id }))}
                            />
                            <span>设为当前档位</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => handleDeleteProfile(profile.id)}
                            disabled={studentProfileEntries.length <= 1}
                            className="text-xs font-medium text-rose-500 hover:text-rose-600 disabled:cursor-not-allowed disabled:text-slate-300">
                            删除
                          </button>
                        </div>
                        <div className="mt-3 space-y-2">
                          <div>
                            <label htmlFor={labelId} className="mb-1 block text-xs font-medium text-slate-600">
                              档位名称
                            </label>
                            <input
                              id={labelId}
                              type="text"
                              value={profile.label}
                              onChange={event => handleProfileChange(profile.id, { label: event.target.value })}
                              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 transition-all focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100"
                            />
                          </div>
                          <div>
                            <label htmlFor={descriptionId} className="mb-1 block text-xs font-medium text-slate-600">
                              角色特征
                            </label>
                            <textarea
                              id={descriptionId}
                              value={profile.description}
                              onChange={event => handleProfileChange(profile.id, { description: event.target.value })}
                              className="min-h-[80px] w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 transition-all focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100"
                            />
                          </div>
                          <div>
                            <label htmlFor={styleId} className="mb-1 block text-xs font-medium text-slate-600">
                              表达风格
                            </label>
                            <textarea
                              id={styleId}
                              value={profile.style}
                              onChange={event => handleProfileChange(profile.id, { style: event.target.value })}
                              className="min-h-[80px] w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 transition-all focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100"
                            />
                          </div>
                          <div>
                            <label htmlFor={fallbackId} className="mb-1 block text-xs font-medium text-slate-600">
                              补充提示（可选）
                            </label>
                            <input
                              id={fallbackId}
                              type="text"
                              value={profile.fallbackHint}
                              onChange={event => handleProfileChange(profile.id, { fallbackHint: event.target.value })}
                              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 transition-all focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'voice' && <VoiceModeSettings config={config} setConfig={setConfig} />}
        </div>

        {/* 底部按钮 */}
        <div className="flex gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <button
            onClick={handleTest}
            disabled={isTesting || !config.apiKey.trim()}
            className="flex-1 cursor-pointer rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">
            {isTesting ? '测试中...' : '测试连接'}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !canSave}
            className="flex-1 cursor-pointer rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 py-2.5 text-sm font-medium text-white transition-all hover:from-teal-600 hover:to-cyan-600 disabled:cursor-not-allowed disabled:opacity-50">
            {isSaving ? '保存中...' : '保存配置'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface ConfigPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}

const ConfigPromptModal = ({ isOpen, onClose, onOpenSettings }: ConfigPromptModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        onKeyDown={e => e.key === 'Escape' && onClose()}
        role="button"
        tabIndex={0}
        aria-label="关闭弹窗"
      />

      <div className="relative w-[85%] max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-orange-100">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-8 w-8 text-amber-500">
            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <h3 className="mb-2 text-lg font-semibold text-slate-800">需要配置 LLM</h3>
        <p className="mb-5 text-sm text-slate-500">使用 AI 自动回复功能需要先配置 LLM 的 API Key</p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 cursor-pointer rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100">
            稍后再说
          </button>
          <button
            onClick={() => {
              onClose();
              onOpenSettings();
            }}
            className="flex-1 cursor-pointer rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 py-2.5 text-sm font-medium text-white transition-all hover:from-teal-600 hover:to-cyan-600">
            去配置
          </button>
        </div>
      </div>
    </div>
  );
};

export { SettingsIcon, SettingsModal, ConfigPromptModal };
