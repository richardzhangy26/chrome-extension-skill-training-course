/**
 * LLM 设置弹窗组件
 */

import { testLLMConfig } from '../services/llm-service';
import {
  AVAILABLE_MODELS,
  DEFAULT_PROFILE_KEY,
  DEFAULT_SYSTEM_PROMPT,
  STUDENT_PROFILES,
  llmConfigStorage,
} from '@extension/storage';
import { useState, useEffect } from 'react';
import type { StudentProfileKey, LLMConfig } from '@extension/storage';

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

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal = ({ isOpen, onClose }: SettingsModalProps) => {
  const [config, setConfig] = useState<LLMConfig>({
    apiKey: '',
    apiUrl: 'http://llm-service.polymas.com/api/openai/v1/chat/completions',
    model: 'Doubao-1.5-pro-32k',
    serviceCode: 'SI_Ability',
    enabled: false,
    systemPromptMode: 'default',
    systemPrompt: '',
    studentProfileKey: DEFAULT_PROFILE_KEY,
  });
  const [activeTab, setActiveTab] = useState<'llm' | 'system' | 'role'>('llm');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // 加载配置
  useEffect(() => {
    if (isOpen) {
      llmConfigStorage.get().then(setConfig);
      setTestResult(null);
      setActiveTab('llm');
    }
  }, [isOpen]);

  // 测试配置
  const handleTest = async () => {
    if (!config.apiKey.trim()) {
      setTestResult({ success: false, message: '请先输入 API Key' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    const result = await testLLMConfig(config);
    setTestResult({
      success: result.success,
      message: result.success ? '✅ 连接成功！' : `❌ ${result.error}`,
    });

    setIsTesting(false);
  };

  // 保存配置
  const handleSave = async () => {
    setIsSaving(true);
    await llmConfigStorage.setConfig({
      ...config,
      enabled: config.apiKey.trim().length > 0,
    });
    setIsSaving(false);
    onClose();
  };

  if (!isOpen) return null;

  const studentProfileEntries = Object.entries(STUDENT_PROFILES) as Array<
    [StudentProfileKey, (typeof STUDENT_PROFILES)[StudentProfileKey]]
  >;
  const systemPromptValue = config.systemPromptMode === 'custom' ? config.systemPrompt : DEFAULT_SYSTEM_PROMPT;

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
            ].map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as 'llm' | 'system' | 'role')}
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

              {/* 模型选择 */}
              <div>
                <label htmlFor="model" className="mb-1.5 block text-sm font-medium text-slate-700">
                  模型
                </label>
                <select
                  id="model"
                  value={config.model}
                  onChange={e => setConfig(prev => ({ ...prev, model: e.target.value }))}
                  className="w-full cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm transition-all focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100">
                  {AVAILABLE_MODELS.map(model => (
                    <option key={model.value} value={model.value}>
                      {model.label}
                    </option>
                  ))}
                </select>
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
                <p className="mt-1 text-xs text-slate-500">选择学生档位后，AI 将按对应角色特征生成回复。</p>
                <div className="mt-3 space-y-3">
                  {studentProfileEntries.map(([key, profile]) => {
                    const isSelected = config.studentProfileKey === key;
                    const inputId = `studentProfile-${key}`;
                    return (
                      <label
                        key={key}
                        htmlFor={inputId}
                        aria-label={profile.label}
                        className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm transition ${
                          isSelected
                            ? 'border-cyan-400 bg-cyan-50/60'
                            : 'border-slate-200 bg-white hover:border-cyan-200'
                        }`}>
                        <input
                          id={inputId}
                          type="radio"
                          name="studentProfile"
                          value={key}
                          checked={isSelected}
                          onChange={() => setConfig(prev => ({ ...prev, studentProfileKey: key }))}
                          className="mt-1"
                        />
                        <div>
                          <div className="text-sm font-medium text-slate-800">{profile.label}</div>
                          <div className="mt-1 text-xs text-slate-500">{profile.description}</div>
                          <div className="mt-1 text-xs text-slate-500">{profile.style}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
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
            disabled={isSaving}
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
        <p className="mb-5 text-sm text-slate-500">使用 AI 自动回复功能需要先配置豆包模型的 API Key</p>

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
