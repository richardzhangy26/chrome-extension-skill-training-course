/**
 * 调试模式步骤选择弹窗
 */

import { useMemo, useState } from 'react';

type ScriptStepItem = {
  stepId: string;
  stepDetailDTO?: {
    stepName?: string;
    stepOrder?: number;
    nodeType?: 'SCRIPT_START' | 'SCRIPT_END' | 'SCRIPT_NODE';
  };
};

interface DebugStepsModalProps {
  isOpen: boolean;
  steps: ScriptStepItem[];
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
  onRefresh: () => void;
  onSelectStep: (stepId: string) => void;
}

const BugIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
    <path d="M8 6h8" />
    <path d="M6 12h12" />
    <path d="M8 18h8" />
    <path d="M9 6V4a3 3 0 0 1 6 0v2" />
    <rect x="7" y="6" width="10" height="12" rx="4" />
    <path d="M4 9h3" />
    <path d="M17 9h3" />
    <path d="M4 15h3" />
    <path d="M17 15h3" />
  </svg>
);

const getStepName = (step: ScriptStepItem) => step.stepDetailDTO?.stepName?.trim() || step.stepId;

const getStepMeta = (step: ScriptStepItem) => {
  const order = step.stepDetailDTO?.stepOrder;
  const type = step.stepDetailDTO?.nodeType;
  if (order == null && !type) {
    return null;
  }
  const orderLabel = order == null ? '' : `#${order}`;
  const typeLabel = type ? (orderLabel ? ` · ${type}` : type) : '';
  return `${orderLabel}${typeLabel}`;
};

const DebugStepsModal = ({
  isOpen,
  steps,
  isLoading,
  error,
  onClose,
  onRefresh,
  onSelectStep,
}: DebugStepsModalProps) => {
  const [keyword, setKeyword] = useState('');

  const filteredSteps = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    return steps
      .filter(step => {
        const type = step.stepDetailDTO?.nodeType;
        return type !== 'SCRIPT_START' && type !== 'SCRIPT_END';
      })
      .filter(step => {
        if (!query) {
          return true;
        }
        const name = getStepName(step).toLowerCase();
        const id = step.stepId.toLowerCase();
        return name.includes(query) || id.includes(query);
      });
  }, [keyword, steps]);

  if (!isOpen) {
    return null;
  }

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

      <div className="relative flex max-h-[85vh] w-[92%] max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-4 text-white">
          <div className="flex items-center gap-2">
            <BugIcon />
            <h2 className="text-lg font-semibold">调试模式</h2>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1 text-white/80 transition-colors hover:bg-white/20 hover:text-white">
            <span className="text-xl leading-none">×</span>
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-hidden p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-600">选择一个步骤直接运行该节点 RunCard</div>
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:text-slate-300">
              刷新列表
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              value={keyword}
              onChange={event => setKeyword(event.target.value)}
              placeholder="搜索 stepName / stepId"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition-all focus:border-cyan-400 focus:bg-white focus:ring-2 focus:ring-cyan-100"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">{error}</div>
          )}

          <div className="flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">正在加载步骤...</div>
            ) : filteredSteps.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">暂无可选步骤</div>
            ) : (
              <div className="space-y-2">
                {filteredSteps.map(step => {
                  const stepName = getStepName(step);
                  const meta = getStepMeta(step);
                  return (
                    <button
                      key={step.stepId}
                      onClick={() => onSelectStep(step.stepId)}
                      className="flex w-full flex-col rounded-lg border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-cyan-300 hover:bg-cyan-50">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-slate-800">{stepName}</span>
                        {meta && <span className="text-xs text-slate-400">{meta}</span>}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">{step.stepId}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export { DebugStepsModal };
