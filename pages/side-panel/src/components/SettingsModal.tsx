/**
 * LLM 设置弹窗组件
 */

import { useState, useEffect } from 'react';
import { llmConfigStorage, AVAILABLE_MODELS, type LLMConfig } from '@extension/storage';
import { testLLMConfig } from '../services/llm-service';

// 关闭图标
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// 设置图标
export const SettingsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
);

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [config, setConfig] = useState<LLMConfig>({
    apiKey: '',
    apiUrl: 'http://llm-service.polymas.com/api/openai/v1/chat/completions',
    model: 'Doubao-1.5-pro-32k',
    serviceCode: 'SI_Ability',
    enabled: false,
  });
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // 加载配置
  useEffect(() => {
    if (isOpen) {
      llmConfigStorage.get().then(setConfig);
      setTestResult(null);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩层 */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* 弹窗内容 */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-[90%] max-w-md max-h-[80vh] overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-violet-500 to-purple-500">
          <h2 className="text-lg font-semibold text-white">LLM 自动回复设置</h2>
          <button
            onClick={onClose}
            className="p-1 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
          >
            <CloseIcon />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[calc(80vh-140px)]">
          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              API Key <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={config.apiKey}
              onChange={e => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
              placeholder="请输入豆包 API Key"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-100 transition-all"
            />
            <p className="mt-1 text-xs text-slate-400">
              需要企业微信申请 llm-service 获取
            </p>
          </div>

          {/* 模型选择 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">模型</label>
            <select
              value={config.model}
              onChange={e => setConfig(prev => ({ ...prev, model: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-100 transition-all cursor-pointer"
            >
              {AVAILABLE_MODELS.map(model => (
                <option key={model.value} value={model.value}>
                  {model.label}
                </option>
              ))}
            </select>
          </div>

          {/* API URL */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">API URL</label>
            <input
              type="text"
              value={config.apiUrl}
              onChange={e => setConfig(prev => ({ ...prev, apiUrl: e.target.value }))}
              placeholder="API 地址"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm font-mono text-xs focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-100 transition-all"
            />
          </div>

          {/* Service Code */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Service Code</label>
            <input
              type="text"
              value={config.serviceCode}
              onChange={e => setConfig(prev => ({ ...prev, serviceCode: e.target.value }))}
              placeholder="服务代码"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-100 transition-all"
            />
          </div>

          {/* 测试结果 */}
          {testResult && (
            <div
              className={`p-3 rounded-lg text-sm ${
                testResult.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
              }`}
            >
              {testResult.message}
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex gap-3 px-5 py-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={handleTest}
            disabled={isTesting || !config.apiKey.trim()}
            className="flex-1 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {isTesting ? '测试中...' : '测试连接'}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-violet-500 to-purple-500 text-white text-sm font-medium hover:from-violet-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            {isSaving ? '保存中...' : '保存配置'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 提示用户配置 LLM 的弹窗
 */
interface ConfigPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}

export function ConfigPromptModal({ isOpen, onClose, onOpenSettings }: ConfigPromptModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-[85%] max-w-sm p-6 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-8 h-8 text-violet-500">
            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <h3 className="text-lg font-semibold text-slate-800 mb-2">需要配置 LLM</h3>
        <p className="text-sm text-slate-500 mb-5">
          使用 AI 自动回复功能需要先配置豆包模型的 API Key
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-slate-300 text-slate-600 text-sm font-medium hover:bg-slate-100 transition-colors cursor-pointer"
          >
            稍后再说
          </button>
          <button
            onClick={() => {
              onClose();
              onOpenSettings();
            }}
            className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-violet-500 to-purple-500 text-white text-sm font-medium hover:from-violet-600 hover:to-purple-600 transition-all cursor-pointer"
          >
            去配置
          </button>
        </div>
      </div>
    </div>
  );
}
