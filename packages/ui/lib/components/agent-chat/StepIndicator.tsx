import { cn } from '../../utils.js';

type WorkflowState =
  | 'IDLE'
  | 'FETCHING_STEPS'
  | 'FETCHING_FIRST_STEP'
  | 'RUNNING_CARD'
  | 'CHATTING'
  | 'COMPLETED'
  | 'ERROR';

interface StepIndicatorProps {
  state: WorkflowState;
  dialogueRound?: number;
  className?: string;
}

const STATE_CONFIG: Record<WorkflowState, { label: string; color: string; icon: string }> = {
  IDLE: { label: '等待开始', color: 'bg-gray-400', icon: '⏸️' },
  FETCHING_STEPS: { label: '获取步骤中...', color: 'bg-yellow-500', icon: '🔄' },
  FETCHING_FIRST_STEP: { label: '初始化步骤...', color: 'bg-yellow-500', icon: '🔄' },
  RUNNING_CARD: { label: '启动对话...', color: 'bg-blue-500', icon: '🚀' },
  CHATTING: { label: '对话中', color: 'bg-green-500', icon: '💬' },
  COMPLETED: { label: '已完成', color: 'bg-green-600', icon: '✅' },
  ERROR: { label: '出错了', color: 'bg-red-500', icon: '❌' },
};

const StepIndicator = ({ state, dialogueRound = 0, className }: StepIndicatorProps) => {
  const config = STATE_CONFIG[state];

  return (
    <div className={cn('flex items-center gap-2 rounded-full px-3 py-1.5 text-xs', className)}>
      {/* 状态指示点 */}
      <div className={cn('h-2 w-2 rounded-full', config.color, state === 'CHATTING' && 'animate-pulse')} />

      {/* 状态图标和文字 */}
      <span className="text-gray-600">
        {config.icon} {config.label}
      </span>

      {/* 对话轮次 */}
      {state === 'CHATTING' && dialogueRound > 0 && <span className="ml-1 text-gray-400">第{dialogueRound}轮</span>}
    </div>
  );
};

export type { WorkflowState, StepIndicatorProps };
export { StepIndicator };
