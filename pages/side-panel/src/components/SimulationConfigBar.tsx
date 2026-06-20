/**
 * 模拟对话 / 知识库 配置栏（文字与口语模式共享）
 * 仅负责展示入口按钮与两个启用开关；配置内容由 SimulationConfigModal 编辑，
 * 开关状态由上层写入全局 llmConfigStorage。
 */

import { normalizeDialogueSimulationContent } from '../services/llm-service';
import type { LLMConfig } from '@extension/storage';

type SimulationModeState = Pick<
  LLMConfig,
  'dialogueSimulationEnabled' | 'dialogueSimulationContent' | 'knowledgeBaseEnabled' | 'knowledgeBaseContent'
>;

interface SimulationConfigBarProps {
  config: SimulationModeState;
  onToggleSimulation: (enabled: boolean) => void;
  onToggleKnowledge: (enabled: boolean) => void;
  onOpenConfig: () => void;
  disabled: boolean;
}

const BookIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

const SimulationConfigBar = ({
  config,
  onToggleSimulation,
  onToggleKnowledge,
  onOpenConfig,
  disabled,
}: SimulationConfigBarProps) => {
  const hasDialogueSimulationContent = Boolean(normalizeDialogueSimulationContent(config.dialogueSimulationContent));
  const hasKnowledgeBaseContent = Boolean(config.knowledgeBaseContent.trim());

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={onOpenConfig}
        disabled={disabled}
        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 transition-all duration-200 hover:border-sky-300 hover:text-sky-600 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
        title="配置对话模拟与知识库模式">
        <BookIcon />
        <span>对话模拟 / 知识库</span>
      </button>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
        <label className="flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={config.dialogueSimulationEnabled}
            disabled={disabled}
            onChange={event => onToggleSimulation(event.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 disabled:cursor-not-allowed"
          />
          <span>模拟对话</span>
          {config.dialogueSimulationEnabled && !hasDialogueSimulationContent && (
            <span className="text-amber-600">未识别内容</span>
          )}
        </label>
        <label className="flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={config.knowledgeBaseEnabled}
            disabled={disabled}
            onChange={event => onToggleKnowledge(event.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 disabled:cursor-not-allowed"
          />
          <span>知识库</span>
          {config.knowledgeBaseEnabled && !hasKnowledgeBaseContent && (
            <span className="text-amber-600">未配置内容</span>
          )}
        </label>
      </div>
    </div>
  );
};

export { SimulationConfigBar };
export type { SimulationModeState };
