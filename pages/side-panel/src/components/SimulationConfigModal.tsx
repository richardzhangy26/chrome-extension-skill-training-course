/**
 * 对话模拟 / 知识库配置弹窗
 */

import { generateSimulationDialogueRecord, normalizeDialogueSimulationContent } from '../services/llm-service';
import { llmConfigStorage } from '@extension/storage';
import { useEffect, useState } from 'react';
import type { GeneratorProfile } from '../services/llm-service';
import type { LLMConfig } from '@extension/storage';

type SimulationConfigDraft = Pick<
  LLMConfig,
  'dialogueSimulationEnabled' | 'dialogueSimulationContent' | 'knowledgeBaseEnabled' | 'knowledgeBaseContent'
>;

interface SimulationConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  trainTaskId: string | null;
}

const createEmptyDraft = (): SimulationConfigDraft => ({
  dialogueSimulationEnabled: false,
  dialogueSimulationContent: '',
  knowledgeBaseEnabled: false,
  knowledgeBaseContent: '',
});

const GENERATOR_PROFILE_OPTIONS: Array<{
  value: GeneratorProfile;
  label: string;
  description: string;
}> = [
  {
    value: 'good',
    label: '好学生',
    description: '基本回答正确，尽量按最佳路径快速通关。',
  },
  {
    value: 'medium',
    label: '一般学生',
    description: '保留 2-3 轮引导过程，最终达标。',
  },
  {
    value: 'poor',
    label: '差学生',
    description: '故意偏离，用于测试边界情况，不强制通关。',
  },
];

const SimulationConfigModal = ({ isOpen, onClose, trainTaskId }: SimulationConfigModalProps) => {
  const [draft, setDraft] = useState<SimulationConfigDraft>(createEmptyDraft);
  const [isSaving, setIsSaving] = useState(false);
  const [generatorProfile, setGeneratorProfile] = useState<GeneratorProfile>('good');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isMounted = true;

    const loadConfig = async () => {
      const config = await llmConfigStorage.get();
      if (!isMounted) {
        return;
      }

      setDraft({
        dialogueSimulationEnabled: config.dialogueSimulationEnabled,
        dialogueSimulationContent: config.dialogueSimulationContent,
        knowledgeBaseEnabled: config.knowledgeBaseEnabled,
        knowledgeBaseContent: config.knowledgeBaseContent,
      });
      setGenerateError(null);
    };

    void loadConfig();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSave = async () => {
    setIsSaving(true);
    await llmConfigStorage.setConfig(draft);
    setIsSaving(false);
    onClose();
  };

  const handleGenerate = async () => {
    if (!trainTaskId) {
      setGenerateError('当前未识别到训练任务，无法根据剧本生成模拟对话。');
      return;
    }

    setIsGenerating(true);
    setGenerateError(null);

    const result = await generateSimulationDialogueRecord({
      trainTaskId,
      profile: generatorProfile,
    });

    if (!result.success || !result.content) {
      setGenerateError(result.error || '生成失败，请稍后重试。');
      setIsGenerating(false);
      return;
    }

    setDraft(prev => ({
      ...prev,
      dialogueSimulationEnabled: true,
      dialogueSimulationContent: result.content || '',
    }));
    setIsGenerating(false);
  };

  const normalizedDialogueSimulationContent = normalizeDialogueSimulationContent(draft.dialogueSimulationContent);
  const showDialogueEmptyHint = draft.dialogueSimulationEnabled && !draft.dialogueSimulationContent.trim();
  const showDialogueFormatHint =
    draft.dialogueSimulationEnabled &&
    Boolean(draft.dialogueSimulationContent.trim()) &&
    !normalizedDialogueSimulationContent;
  const showKnowledgeBaseEmptyHint = draft.knowledgeBaseEnabled && !draft.knowledgeBaseContent.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        onKeyDown={event => event.key === 'Escape' && onClose()}
        role="button"
        tabIndex={0}
        aria-label="关闭弹窗"
      />

      <div className="relative flex max-h-[88vh] w-[92%] max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-sky-600 to-cyan-500 px-5 py-4 text-white">
          <div>
            <h2 className="text-lg font-semibold">对话模拟 / 知识库模式</h2>
            <p className="mt-1 text-xs text-white/80">仅影响 AI 自动回复与 AI 全自动回复，不影响手动发送。</p>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1 text-white/80 transition-colors hover:bg-white/20 hover:text-white">
            <span className="text-xl leading-none">×</span>
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-5">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">模拟对话</h3>
                <p className="mt-1 text-xs text-slate-500">
                  请粘贴历史对话日志，或按 <code className="rounded bg-slate-100 px-1 py-0.5">AI:</code> /{' '}
                  <code className="rounded bg-slate-100 px-1 py-0.5">用户:</code> 一问一答整理的内容。系统会自动忽略{' '}
                  <code className="rounded bg-slate-100 px-1 py-0.5">Step:</code> 和分隔线等元信息。
                </p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={draft.dialogueSimulationEnabled}
                  onChange={event =>
                    setDraft(prev => ({
                      ...prev,
                      dialogueSimulationEnabled: event.target.checked,
                    }))
                  }
                />
                启用
              </label>
            </div>

            <div className="mt-3">
              <label htmlFor="dialogueSimulationContent" className="mb-1.5 block text-xs font-medium text-slate-600">
                请粘贴历史日志或模拟对话内容
              </label>
              <textarea
                id="dialogueSimulationContent"
                value={draft.dialogueSimulationContent}
                onChange={event =>
                  setDraft(prev => ({
                    ...prev,
                    dialogueSimulationContent: event.target.value,
                  }))
                }
                rows={10}
                placeholder={
                  '例如：\nStep: 开场确认 | step_id: demo-step | 第 1 轮 | 来源: chat\nAI: 你准备好了吗？\n用户: 准备好了。\n----------------------------------------'
                }
                className="min-h-[220px] w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 transition-all focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100"
              />
              {showDialogueEmptyHint && (
                <p className="mt-2 text-xs text-amber-600">当前已启用，但内容为空，运行时不会注入模拟对话片段。</p>
              )}
              {showDialogueFormatHint && (
                <p className="mt-2 text-xs text-amber-600">
                  未识别到有效的一问一答记录，请按历史日志中的 <code>AI:</code> / <code>用户:</code> 格式粘贴。
                </p>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-dashed border-sky-200 bg-sky-50/60 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-sky-900">根据剧本生成模拟对话</h4>
                  <p className="mt-1 text-xs text-sky-700">
                    自动读取当前训练任务的 script list 与默认 flow，生成可直接回填的历史日志格式对话记录。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isGenerating || !trainTaskId}
                  className="cursor-pointer rounded-lg bg-gradient-to-r from-sky-600 to-cyan-500 px-3 py-2 text-xs font-medium text-white transition-all hover:from-sky-700 hover:to-cyan-600 disabled:cursor-not-allowed disabled:opacity-50">
                  {isGenerating ? '生成中...' : '根据剧本生成'}
                </button>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {GENERATOR_PROFILE_OPTIONS.map(option => {
                  const isSelected = generatorProfile === option.value;
                  return (
                    <label
                      key={option.value}
                      className={`cursor-pointer rounded-lg border px-3 py-2 text-xs transition ${
                        isSelected
                          ? 'border-sky-400 bg-white text-sky-900'
                          : 'border-sky-100 bg-white/80 text-slate-600'
                      }`}>
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="generatorProfile"
                          value={option.value}
                          checked={isSelected}
                          onChange={() => setGeneratorProfile(option.value)}
                          disabled={isGenerating}
                        />
                        <span className="font-medium">{option.label}</span>
                      </div>
                      <p className="mt-1 leading-5">{option.description}</p>
                    </label>
                  );
                })}
              </div>

              {generateError && <p className="mt-3 text-xs text-rose-600">{generateError}</p>}
              {!trainTaskId && (
                <p className="mt-3 text-xs text-amber-600">未检测到 trainTaskId，暂时不能根据剧本自动生成。</p>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">知识库</h3>
                <p className="mt-1 text-xs text-slate-500">
                  请粘贴训练相关资料。自动回复时会把这部分作为参考知识库一起提供给模型。
                </p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={draft.knowledgeBaseEnabled}
                  onChange={event =>
                    setDraft(prev => ({
                      ...prev,
                      knowledgeBaseEnabled: event.target.checked,
                    }))
                  }
                />
                启用
              </label>
            </div>

            <div className="mt-3">
              <label htmlFor="knowledgeBaseContent" className="mb-1.5 block text-xs font-medium text-slate-600">
                请粘贴知识库内容
              </label>
              <textarea
                id="knowledgeBaseContent"
                value={draft.knowledgeBaseContent}
                onChange={event =>
                  setDraft(prev => ({
                    ...prev,
                    knowledgeBaseContent: event.target.value,
                  }))
                }
                rows={10}
                placeholder="例如：课程要点、标准答案、评分口径、背景资料等。"
                className="min-h-[220px] w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 transition-all focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100"
              />
              {showKnowledgeBaseEmptyHint && (
                <p className="mt-2 text-xs text-amber-600">当前已启用，但内容为空，运行时不会注入知识库片段。</p>
              )}
            </div>
          </section>
        </div>

        <div className="flex gap-3 border-t border-slate-200 bg-white px-5 py-4">
          <button
            onClick={onClose}
            className="flex-1 cursor-pointer rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100">
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 cursor-pointer rounded-lg bg-gradient-to-r from-sky-600 to-cyan-500 py-2.5 text-sm font-medium text-white transition-all hover:from-sky-700 hover:to-cyan-600 disabled:cursor-not-allowed disabled:opacity-50">
            {isSaving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
};

export { SimulationConfigModal };
