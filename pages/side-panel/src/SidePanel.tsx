import '@src/SidePanel.css';
import { DebugStepsModal } from './components/DebugStepsModal';
import { HistoryModal, HistoryIcon } from './components/HistoryModal';
import { ModelBrandIcon } from './components/ModelBrandIcon';
import { ModeToggle } from './components/ModeToggle';
import { MultiRolePickerModal } from './components/MultiRolePickerModal';
import { SettingsModal, ConfigPromptModal, SettingsIcon } from './components/SettingsModal';
import { SimulationConfigModal } from './components/SimulationConfigModal';
import { useAgentChat } from './hooks/useAgentChat';
import { useMultiRoleRun } from './hooks/useMultiRoleRun';
import { useVoiceAgentChat } from './hooks/useVoiceAgentChat';
import { normalizeDialogueSimulationContent } from './services/llm-service';
import { llmConfigStorage } from '@extension/storage';
import { useRef, useEffect, useState } from 'react';
import type { TrainingMode } from './components/ModeToggle';
import type { ChatMessage } from './hooks/useAgentChat';
import type { MultiRoleRunBatch, RoleRunDraft } from './types/multi-role-types';
import type { LLMConfig } from '@extension/storage';

// ============ SVG图标组件 ============
const Icons = {
  // Logo图标 - 基于logo配色的抽象图形
  Logo: () => (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
      <path d="M12 2L2 7l10 5 10-5-10-5z" fill="url(#logoGradient)" />
      <path
        d="M2 17l10 5 10-5"
        stroke="url(#logoGradient)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2 12l10 5 10-5"
        stroke="url(#logoGradient)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="50%" stopColor="#06B6D4" />
          <stop offset="100%" stopColor="#10B981" />
        </linearGradient>
      </defs>
    </svg>
  ),
  // 用户图标
  User: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  // AI助手图标
  Bot: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
      <line x1="8" y1="16" x2="8" y2="16" />
      <line x1="16" y1="16" x2="16" y2="16" />
    </svg>
  ),
  // 系统消息图标
  Info: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  // 发送图标
  Send: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  ),
  // AI魔法棒图标
  Sparkles: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
      <path d="M5 19l1 3 1-3 3-1-3-1-1-3-1 3-3 1 3 1z" />
      <path d="M19 12l1 2 1-2 2-1-2-1-1-2-1 2-2 1 2 1z" />
    </svg>
  ),
  // 调试图标
  Bug: () => (
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
  ),
  Book: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  // 重置图标
  Refresh: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  ),
  // 播放/开始图标
  Play: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
  // 循环运行图标
  Repeat: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  ),
  // 停止图标
  Stop: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  ),
  // 消息图标
  MessageCircle: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-12 w-12">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  ),
  // 加载中
  Loader: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 animate-spin">
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
    </svg>
  ),
  // 检查/完成图标
  Check: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  // 错误图标
  AlertCircle: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  // 多用户/多角色图标
  Users: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
};

// ============ 类型定义 ============
type WorkflowState =
  | 'IDLE'
  | 'FETCHING_STEPS'
  | 'FETCHING_FIRST_STEP'
  | 'RUNNING_CARD'
  | 'CHATTING'
  | 'COMPLETED'
  | 'ERROR';

type SimulationModeState = Pick<
  LLMConfig,
  'dialogueSimulationEnabled' | 'dialogueSimulationContent' | 'knowledgeBaseEnabled' | 'knowledgeBaseContent'
>;

// ============ 状态配置 ============
const STATE_CONFIG: Record<WorkflowState, { label: string; bgColor: string; dotColor: string }> = {
  IDLE: { label: '等待开始', bgColor: 'bg-slate-100', dotColor: 'bg-slate-400' },
  FETCHING_STEPS: { label: '获取步骤中...', bgColor: 'bg-amber-50', dotColor: 'bg-amber-400' },
  FETCHING_FIRST_STEP: { label: '初始化步骤...', bgColor: 'bg-amber-50', dotColor: 'bg-amber-400' },
  RUNNING_CARD: { label: '启动对话...', bgColor: 'bg-cyan-50', dotColor: 'bg-cyan-400' },
  CHATTING: { label: '对话中', bgColor: 'bg-emerald-50', dotColor: 'bg-emerald-400' },
  COMPLETED: { label: '已完成', bgColor: 'bg-emerald-50', dotColor: 'bg-emerald-500' },
  ERROR: { label: '出错了', bgColor: 'bg-red-50', dotColor: 'bg-red-400' },
};

const createSimulationModeState = (): SimulationModeState => ({
  dialogueSimulationEnabled: false,
  dialogueSimulationContent: '',
  knowledgeBaseEnabled: false,
  knowledgeBaseContent: '',
});

// ============ Header组件 ============
const Header = ({
  trainTaskId,
  trainTaskName,
  workflowState,
  dialogueRound,
  onReset,
  onOpenSettings,
  onOpenHistory,
  mode,
  onChangeMode,
  modeToggleDisabled,
}: {
  trainTaskId: string | null;
  trainTaskName?: string | null;
  workflowState: WorkflowState;
  dialogueRound: number;
  onReset: () => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  mode: TrainingMode;
  onChangeMode: (mode: TrainingMode) => void;
  modeToggleDisabled: boolean;
}) => {
  const config = STATE_CONFIG[workflowState];
  const isProcessing = ['FETCHING_STEPS', 'FETCHING_FIRST_STEP', 'RUNNING_CARD'].includes(workflowState);

  return (
    <div className="relative overflow-hidden">
      {/* 渐变背景 */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-cyan-500 to-emerald-400" />
      {/* 装饰性光晕 */}
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute -bottom-10 -left-10 h-24 w-24 rounded-full bg-white/10 blur-xl" />

      <div className="relative px-4 py-4">
        {/* 标题行 */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-white/20 p-1.5 backdrop-blur-sm">
              <Icons.Logo />
            </div>
            <h1 className="text-lg font-semibold tracking-tight text-white">
              {mode === 'voice' ? '口语训练助手' : '能力训练助手'}
            </h1>
            <ModeToggle mode={mode} onChange={onChangeMode} disabled={modeToggleDisabled} />
          </div>
          <div className="flex items-center gap-2">
            {/* 设置按钮 */}
            <button
              onClick={onOpenSettings}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1.5 text-xs text-white/90 backdrop-blur-sm transition-all duration-200 hover:bg-white/25 hover:text-white"
              title="LLM 设置">
              <SettingsIcon />
              <span>设置</span>
            </button>
            <button
              onClick={onOpenHistory}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1.5 text-xs text-white/90 backdrop-blur-sm transition-all duration-200 hover:bg-white/25 hover:text-white"
              title="历史记录">
              <HistoryIcon />
              <span>历史</span>
            </button>
            {workflowState !== 'IDLE' && (
              <button
                onClick={onReset}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1.5 text-xs text-white/90 backdrop-blur-sm transition-all duration-200 hover:bg-white/25 hover:text-white">
                <Icons.Refresh />
                <span>重置</span>
              </button>
            )}
          </div>
        </div>

        {/* 任务标签 */}
        {trainTaskId && (
          <div
            className="mb-3 inline-flex max-w-full items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 text-xs text-white/80 backdrop-blur-sm"
            title={trainTaskName ? `${trainTaskName} · ${trainTaskId}` : trainTaskId}>
            <span className="text-white/50">任务:</span>
            {trainTaskName ? (
              <span className="truncate font-medium">{trainTaskName}</span>
            ) : (
              <span className="font-mono">{trainTaskId.substring(0, 16)}...</span>
            )}
          </div>
        )}

        {/* 状态指示器 */}
        <div className={`flex items-center gap-2 text-xs ${config.bgColor} rounded-lg px-3 py-2`}>
          <div className={`h-2 w-2 rounded-full ${config.dotColor} ${isProcessing ? 'animate-pulse' : ''}`} />
          <span className="font-medium text-slate-700">{config.label}</span>
          {workflowState === 'CHATTING' && dialogueRound > 0 && (
            <span className="ml-auto text-slate-500">第 {dialogueRound} 轮对话</span>
          )}
          {workflowState === 'COMPLETED' && (
            <span className="ml-auto flex items-center gap-1 text-emerald-600">
              <Icons.Check />
              训练完成
            </span>
          )}
          {workflowState === 'ERROR' && (
            <span className="ml-auto flex items-center gap-1 text-red-600">
              <Icons.AlertCircle />
              请重试
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// ============ MessageBubble组件 ============
const MessageBubble = ({ message }: { message: ChatMessage }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const modelId = message.modelId;
  // 配置的 LLM 生成的是「学生回答」(user 消息)，品牌图标挂在该回答上以标明生成模型
  const hasModelAvatar = isUser && Boolean(modelId);

  return (
    <div className={`mb-4 flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
      {/* 头像 - 非用户消息显示在左边 */}
      {!isUser && (
        <div
          className={`mr-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
            isSystem ? 'bg-slate-100 text-slate-500' : 'bg-gradient-to-br from-cyan-400 to-blue-500 text-white'
          }`}>
          {isSystem ? <Icons.Info /> : <Icons.Bot />}
        </div>
      )}

      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'rounded-br-md bg-gradient-to-br from-teal-500 to-cyan-500 text-white shadow-lg shadow-teal-500/20'
            : isSystem
              ? 'border border-slate-200 bg-slate-100 text-sm text-slate-600'
              : 'rounded-bl-md border border-slate-200 bg-white text-slate-800 shadow-sm'
        }`}>
        {/* 角色标识 */}
        <div
          className={`mb-1.5 flex items-center gap-1 text-xs font-medium ${
            isUser ? 'text-white/70' : isSystem ? 'text-slate-400' : 'text-cyan-600'
          }`}>
          {isUser ? '你' : isSystem ? '系统提示' : 'AI 助手'}
          {message.isAutoGenerated && (
            <span className="ml-1 rounded bg-white/20 px-1.5 py-0.5 text-[10px]">自动生成</span>
          )}
        </div>

        {/* 消息内容 */}
        <div className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</div>

        {/* 时间戳 */}
        <div className={`mt-2 text-[10px] ${isUser ? 'text-right text-white/50' : 'text-slate-400'}`}>
          {new Date(message.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      {/* 头像 - 用户消息显示在右边；自动生成的学生回答显示生成模型品牌 */}
      {isUser && (
        <div
          title={hasModelAvatar ? modelId : undefined}
          className={`ml-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
            hasModelAvatar
              ? 'border border-slate-200 bg-white text-slate-600 shadow-sm'
              : 'bg-gradient-to-br from-blue-400 to-cyan-500 text-white'
          }`}>
          {hasModelAvatar && modelId ? <ModelBrandIcon modelId={modelId} size={18} /> : <Icons.User />}
        </div>
      )}
    </div>
  );
};

// ============ MessageList组件 ============
const MessageList = ({ messages, isLoading }: { messages: ChatMessage[]; isLoading: boolean }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 to-white p-4">
      {messages.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center text-slate-400">
          <div className="mb-4 rounded-full bg-gradient-to-br from-cyan-50 to-blue-50 p-4">
            <Icons.MessageCircle />
          </div>
          <div className="mb-1 text-base font-medium text-slate-500">开始你的训练之旅</div>
          <div className="text-sm text-slate-400">点击下方按钮开始对话</div>
        </div>
      ) : (
        <>
          {messages.map(message => (
            <MessageBubble key={message.id} message={message} />
          ))}

          {/* 加载指示器 */}
          {isLoading && (
            <div className="mb-4 flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <div
                    className="h-2 w-2 animate-bounce rounded-full bg-gradient-to-r from-teal-400 to-cyan-400"
                    style={{ animationDelay: '0ms' }}
                  />
                  <div
                    className="h-2 w-2 animate-bounce rounded-full bg-gradient-to-r from-cyan-400 to-sky-400"
                    style={{ animationDelay: '150ms' }}
                  />
                  <div
                    className="h-2 w-2 animate-bounce rounded-full bg-gradient-to-r from-sky-400 to-blue-400"
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
                <span className="ml-1 text-sm text-slate-400">AI 正在思考...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </>
      )}
    </div>
  );
};

// ============ ChatInput组件 ============
const ChatInput = ({
  onSend,
  onAutoGenerate,
  onAutoRun,
  onStopAutoRun,
  isAutoRunning,
  onOpenDebug,
  onOpenSimulationConfig,
  onOpenMultiRole,
  simulationConfig,
  onToggleDialogueSimulation,
  onToggleKnowledgeBase,
  toggleDisabled,
  debugDisabled,
  disabled,
}: {
  onSend: (content: string) => void;
  onAutoGenerate: () => void;
  onAutoRun: () => void;
  onStopAutoRun: () => void;
  isAutoRunning: boolean;
  onOpenDebug: () => void;
  onOpenSimulationConfig: () => void;
  onOpenMultiRole: () => void;
  simulationConfig: SimulationModeState;
  onToggleDialogueSimulation: (enabled: boolean) => void;
  onToggleKnowledgeBase: (enabled: boolean) => void;
  toggleDisabled: boolean;
  debugDisabled: boolean;
  disabled: boolean;
}) => {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasDialogueSimulationContent = Boolean(
    normalizeDialogueSimulationContent(simulationConfig.dialogueSimulationContent),
  );
  const hasKnowledgeBaseContent = Boolean(simulationConfig.knowledgeBaseContent.trim());

  const handleSend = () => {
    const trimmed = value.trim();
    if (trimmed) {
      if (isAutoRunning) {
        onStopAutoRun();
      }
      onSend(trimmed);
      setValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        handleSend();
      } else if (!e.shiftKey && !value.trim()) {
        e.preventDefault();
        if (isAutoRunning) {
          onStopAutoRun();
        }
        onAutoGenerate();
      } else if (!e.shiftKey && value.trim()) {
        e.preventDefault();
        handleSend();
      }
    }
  };

  return (
    <div className="border-t border-slate-200 bg-white p-4">
      <div className="mb-2 flex flex-col items-start gap-2">
        <div className="flex flex-col items-start gap-1">
          <button
            onClick={onOpenDebug}
            disabled={debugDisabled}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 transition-all duration-200 hover:border-cyan-300 hover:text-cyan-600 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
            title="选择步骤调试运行">
            <Icons.Bug />
            <span>调试模式</span>
          </button>
          <span className="text-[11px] text-slate-400">选择步骤快速跳转</span>
        </div>

        <div className="flex flex-col items-start gap-1">
          <button
            onClick={onOpenSimulationConfig}
            disabled={debugDisabled}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 transition-all duration-200 hover:border-sky-300 hover:text-sky-600 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
            title="配置对话模拟与知识库模式">
            <Icons.Book />
            <span>对话模拟 / 知识库</span>
          </button>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={simulationConfig.dialogueSimulationEnabled}
                disabled={toggleDisabled}
                onChange={event => onToggleDialogueSimulation(event.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 disabled:cursor-not-allowed"
              />
              <span>模拟对话</span>
              {simulationConfig.dialogueSimulationEnabled && !hasDialogueSimulationContent && (
                <span className="text-amber-600">未识别内容</span>
              )}
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={simulationConfig.knowledgeBaseEnabled}
                disabled={toggleDisabled}
                onChange={event => onToggleKnowledgeBase(event.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 disabled:cursor-not-allowed"
              />
              <span>知识库</span>
              {simulationConfig.knowledgeBaseEnabled && !hasKnowledgeBaseContent && (
                <span className="text-amber-600">未配置内容</span>
              )}
            </label>
          </div>
        </div>

        <div className="flex flex-col items-start gap-1">
          <button
            onClick={onOpenMultiRole}
            disabled={debugDisabled}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs text-blue-700 transition-all duration-200 hover:border-blue-400 hover:text-blue-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
            title="选择多个学生档位并行训练">
            <Icons.Users />
            <span>多角色并行</span>
          </button>
          <span className="text-[11px] text-slate-400">同时运行多个角色对比</span>
        </div>
      </div>
      <div className="flex items-end gap-3">
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={e => {
              if (isAutoRunning) {
                onStopAutoRun();
              }
              setValue(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="输入你的回答..."
            rows={2}
            className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 placeholder-slate-400 transition-all duration-200 focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:bg-slate-100"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="group relative">
            <button
              onClick={isAutoRunning ? onStopAutoRun : onAutoRun}
              disabled={!isAutoRunning && disabled}
              className={`cursor-pointer rounded-xl p-2.5 text-white transition-all duration-200 hover:shadow-lg disabled:cursor-not-allowed disabled:shadow-none ${
                isAutoRunning
                  ? 'bg-gradient-to-br from-rose-500 to-red-500 hover:from-rose-600 hover:to-red-600 hover:shadow-red-500/25'
                  : 'bg-gradient-to-br from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 hover:shadow-emerald-500/25'
              }`}>
              {isAutoRunning ? <Icons.Stop /> : <Icons.Repeat />}
            </button>
            <div className="pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              {isAutoRunning ? '停止连续对话' : 'AI 全自动回复'}
              <div className="absolute -right-1 top-1/2 -translate-y-1/2 border-4 border-transparent border-l-slate-800" />
            </div>
          </div>

          <div className="group relative">
            <button
              onClick={onAutoGenerate}
              disabled={disabled || isAutoRunning}
              className="cursor-pointer rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 p-2.5 text-white transition-all duration-200 hover:from-amber-600 hover:to-orange-600 hover:shadow-lg hover:shadow-orange-500/25 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none">
              <Icons.Sparkles />
            </button>
            <div className="pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              AI 回复下一轮
              <div className="absolute -right-1 top-1/2 -translate-y-1/2 border-4 border-transparent border-l-slate-800" />
            </div>
          </div>

          <div className="group relative">
            <button
              onClick={handleSend}
              disabled={disabled || !value.trim()}
              className="cursor-pointer rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 p-2.5 text-white transition-all duration-200 hover:from-cyan-600 hover:to-blue-600 hover:shadow-lg hover:shadow-blue-500/25 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none">
              <Icons.Send />
            </button>
            <div className="pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              发送消息
              <div className="absolute -right-1 top-1/2 -translate-y-1/2 border-4 border-transparent border-l-slate-800" />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-slate-400">
        <span className="flex items-center gap-1">
          <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">Enter</kbd>
          发送
        </span>
        <span className="flex items-center gap-1">
          <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">空白+Enter</kbd>
          AI回答
        </span>
        <span className="flex items-center gap-1">
          <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">Shift+Enter</kbd>
          换行
        </span>
      </div>
    </div>
  );
};

// ============ StartButton组件 ============
const StartButton = ({
  onClick,
  disabled,
  trainTaskId,
}: {
  onClick: () => void;
  disabled: boolean;
  trainTaskId: string | null;
}) => (
  <div className="border-t border-slate-200 bg-white p-5">
    <button
      onClick={onClick}
      disabled={disabled || !trainTaskId}
      className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-400 py-3.5 font-medium text-white transition-all duration-300 hover:-translate-y-0.5 hover:from-blue-700 hover:via-cyan-600 hover:to-emerald-500 hover:shadow-xl hover:shadow-blue-500/30 disabled:translate-y-0 disabled:cursor-not-allowed disabled:from-slate-300 disabled:via-slate-400 disabled:to-slate-300 disabled:shadow-none">
      <Icons.Play />
      <span>{!trainTaskId ? '请在训练页面打开' : '开始训练'}</span>
    </button>
    {!trainTaskId && (
      <p className="mt-3 text-center text-xs text-slate-400">
        请访问包含 <code className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">trainTaskId</code> 参数的训练页面
      </p>
    )}
  </div>
);

// ============ 多角色折叠视图 ============
const MultiRoleView = ({
  batch,
  isLoading,
  isBatchAutoRunning,
  onSetActiveRole,
  onViewHistory,
}: {
  batch: MultiRoleRunBatch;
  isLoading: boolean;
  isBatchAutoRunning: boolean;
  onSetActiveRole: (index: number) => void;
  onViewHistory: (logSessionId: string) => void;
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [batch]);

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 to-white p-3">
      {/* batch 状态概览 */}
      <div className="mb-3 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs">
        <div
          className={`h-2 w-2 rounded-full ${
            batch.batchState === 'RUNNING'
              ? 'animate-pulse bg-blue-400'
              : batch.batchState === 'COMPLETED'
                ? 'bg-emerald-500'
                : batch.batchState === 'ERROR'
                  ? 'bg-red-400'
                  : 'bg-slate-400'
          }`}
        />
        <span className="font-medium text-blue-700">
          多角色模式 · {batch.roles.length} 个角色
          {isBatchAutoRunning && ' · 自动运行中'}
        </span>
      </div>

      {/* 角色卡片列表（手风琴） */}
      <div className="space-y-2">
        {batch.roles.map((role, index) => {
          const isActive = index === batch.activeRoleIndex;
          const stateConfig = STATE_CONFIG[role.workflowState];
          const stepProgress = role.currentStepId
            ? `${batch.orderedStepIds.indexOf(role.currentStepId) + 1}/${batch.orderedStepIds.length}`
            : '--/--';
          const recentMessages = role.messages.slice(-10);

          return (
            <div key={role.profileId} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              {/* 折叠头 */}
              <div
                className={`flex cursor-pointer items-center gap-2.5 px-3 py-2.5 transition-colors ${
                  isActive ? 'bg-blue-50' : 'hover:bg-slate-50'
                }`}
                onClick={() => onSetActiveRole(isActive ? -1 : index)}
                onKeyDown={e => e.key === 'Enter' && onSetActiveRole(isActive ? -1 : index)}
                role="button"
                tabIndex={0}
                aria-label={`展开角色 ${role.profileLabel}`}
                aria-expanded={isActive}>
                <div className={`h-2 w-2 flex-shrink-0 rounded-full ${stateConfig.dotColor}`} />
                <span className="flex-1 text-sm font-medium text-slate-800">{role.profileLabel}</span>
                <span className="text-xs text-slate-400">{stepProgress} 步</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${stateConfig.bgColor} text-slate-600`}>
                  {stateConfig.label}
                </span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={`h-4 w-4 text-slate-400 transition-transform ${isActive ? 'rotate-180' : ''}`}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>

              {/* 展开内容 */}
              {isActive && (
                <div className="border-t border-slate-100 px-3 py-2.5">
                  {recentMessages.length === 0 ? (
                    <p className="py-2 text-center text-xs text-slate-400">暂无消息</p>
                  ) : (
                    <div className="space-y-1.5">
                      {recentMessages.map(msg => (
                        <div key={msg.id} className="flex items-start gap-2 text-xs">
                          <span
                            className={`mt-0.5 flex-shrink-0 rounded px-1 py-0.5 text-[10px] font-medium ${
                              msg.role === 'user'
                                ? 'bg-teal-50 text-teal-700'
                                : msg.role === 'assistant'
                                  ? 'bg-cyan-50 text-cyan-700'
                                  : 'bg-slate-100 text-slate-500'
                            }`}>
                            {msg.role === 'user' ? '学生' : msg.role === 'assistant' ? 'AI' : '系统'}
                          </span>
                          <p className="flex-1 text-slate-600">{msg.content}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 查看完整对话按钮 */}
                  {role.logSessionId && role.messages.length > 0 && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onViewHistory(role.logSessionId!);
                      }}
                      className="mt-2 w-full cursor-pointer rounded-lg border border-slate-200 py-1.5 text-xs text-slate-500 transition-colors hover:border-blue-300 hover:text-blue-600">
                      查看完整对话
                    </button>
                  )}

                  {role.error && <p className="mt-2 text-xs text-red-500">{role.error}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 加载指示器 */}
      {isLoading && (
        <div className="mt-3 flex items-center justify-center gap-2 text-sm text-slate-400">
          <div className="flex items-center gap-1.5">
            <div
              className="h-2 w-2 animate-bounce rounded-full bg-gradient-to-r from-blue-400 to-cyan-400"
              style={{ animationDelay: '0ms' }}
            />
            <div
              className="h-2 w-2 animate-bounce rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400"
              style={{ animationDelay: '150ms' }}
            />
            <div
              className="h-2 w-2 animate-bounce rounded-full bg-gradient-to-r from-emerald-400 to-blue-400"
              style={{ animationDelay: '300ms' }}
            />
          </div>
          <span>处理中...</span>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};

// ============ 多角色底部操作区 ============
const MultiRoleChatInput = ({
  onSend,
  onAutoRun,
  onStopAutoRun,
  isAutoRunning,
  onReset,
  disabled,
  activeRoleLabel,
}: {
  onSend: (content: string) => void;
  onAutoRun: () => void;
  onStopAutoRun: () => void;
  isAutoRunning: boolean;
  onReset: () => void;
  disabled: boolean;
  activeRoleLabel: string | null;
}) => {
  const [value, setValue] = useState('');

  const handleSend = () => {
    const trimmed = value.trim();
    if (trimmed) {
      onSend(trimmed);
      setValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) {
        handleSend();
      }
    }
  };

  return (
    <div className="border-t border-slate-200 bg-white p-4">
      {activeRoleLabel && (
        <div className="mb-2 text-xs text-slate-400">
          手动输入将发送给: <span className="font-medium text-blue-600">{activeRoleLabel}</span>
        </div>
      )}

      <div className="flex items-end gap-3">
        <textarea
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="输入回答（仅发送给当前选中角色）..."
          rows={2}
          className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 placeholder-slate-400 transition-all focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:bg-slate-100"
        />

        <div className="flex flex-col gap-2">
          {/* 全自动运行 / 停止 */}
          <div className="group relative">
            <button
              onClick={isAutoRunning ? onStopAutoRun : onAutoRun}
              disabled={!isAutoRunning && disabled}
              className={`cursor-pointer rounded-xl p-2.5 text-white transition-all duration-200 hover:shadow-lg disabled:cursor-not-allowed disabled:shadow-none ${
                isAutoRunning
                  ? 'bg-gradient-to-br from-rose-500 to-red-500 hover:from-rose-600 hover:to-red-600 hover:shadow-red-500/25'
                  : 'bg-gradient-to-br from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 hover:shadow-blue-500/25'
              }`}>
              {isAutoRunning ? <Icons.Stop /> : <Icons.Repeat />}
            </button>
            <div className="pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              {isAutoRunning ? '停止全部自动运行' : '全部角色自动运行'}
              <div className="absolute -right-1 top-1/2 -translate-y-1/2 border-4 border-transparent border-l-slate-800" />
            </div>
          </div>

          {/* 发送 */}
          <div className="group relative">
            <button
              onClick={handleSend}
              disabled={disabled || !value.trim()}
              className="cursor-pointer rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 p-2.5 text-white transition-all duration-200 hover:from-cyan-600 hover:to-blue-600 hover:shadow-lg hover:shadow-cyan-500/25 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none">
              <Icons.Send />
            </button>
            <div className="pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              发送给当前角色
              <div className="absolute -right-1 top-1/2 -translate-y-1/2 border-4 border-transparent border-l-slate-800" />
            </div>
          </div>

          {/* 重置 */}
          <div className="group relative">
            <button
              onClick={onReset}
              className="cursor-pointer rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 transition-all duration-200 hover:border-red-300 hover:text-red-500">
              <Icons.Refresh />
            </button>
            <div className="pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              退出多角色模式
              <div className="absolute -right-1 top-1/2 -translate-y-1/2 border-4 border-transparent border-l-slate-800" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============ VoiceChatArea 组件 ============
interface VoiceChatAreaProps {
  voice: ReturnType<typeof useVoiceAgentChat>;
  voiceStateLabel: string;
  canStart: boolean;
  onStart: () => void;
  onAutoGenerate: () => void | Promise<void>;
  onAutoRunToggle: () => void | Promise<void>;
  trainTaskId: string | null;
}

const VoiceChatArea = ({
  voice,
  voiceStateLabel,
  canStart,
  onStart,
  onAutoGenerate,
  onAutoRunToggle,
  trainTaskId,
}: VoiceChatAreaProps) => {
  const [input, setInput] = useState('');
  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setInput('');
    void voice.sendUserText(trimmed);
  };

  const disabled = voice.isLoading || voice.voiceState === 'SENDING_AUDIO' || voice.voiceState === 'CONNECTING';
  const autoRunning = voice.isAutoRunning;

  return (
    <>
      <MessageList messages={voice.messages} isLoading={voice.isLoading} />
      {voice.voiceState === 'IDLE' || voice.voiceState === 'ERROR' ? (
        <div className="border-t border-slate-200 bg-white p-5">
          <button
            type="button"
            onClick={onStart}
            disabled={!canStart || !trainTaskId}
            className="w-full cursor-pointer rounded-xl bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-400 py-3.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/30 transition-all hover:shadow-cyan-500/40 disabled:cursor-not-allowed disabled:from-slate-300 disabled:via-slate-300 disabled:to-slate-300 disabled:shadow-none">
            {trainTaskId ? '🎙️ 建立语音通道' : '请先进入含 trainTaskId 的训练页面'}
          </button>
        </div>
      ) : (
        <div className="border-t border-slate-200 bg-white">
          <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
            <span
              className={`inline-flex h-2 w-2 rounded-full ${autoRunning ? 'animate-pulse bg-emerald-500' : 'bg-cyan-500'}`}
            />
            <span className="font-medium text-slate-700">{voiceStateLabel}</span>
            {autoRunning && <span className="text-emerald-600">· 全自动运行中</span>}
            <span className="ml-auto">第 {voice.dialogueRound} 轮</span>
          </div>
          <div className="flex items-stretch gap-2 p-3">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={disabled || autoRunning}
              placeholder={
                autoRunning
                  ? '全自动模式已开启，手动发送已禁用'
                  : disabled
                    ? '处理中，请稍候...'
                    : '输入回答（Enter 发送 / Shift+Enter 换行）'
              }
              rows={2}
              className="flex-1 resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm transition-all focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void onAutoRunToggle()}
                disabled={voice.voiceState === 'COMPLETED'}
                title={autoRunning ? '停止全自动' : '开启全自动循环'}
                className={`flex h-8 w-10 cursor-pointer items-center justify-center rounded-lg text-white shadow-md transition-all disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none ${
                  autoRunning
                    ? 'bg-gradient-to-br from-red-500 to-rose-500 shadow-red-500/30 hover:shadow-red-500/40'
                    : 'bg-gradient-to-br from-emerald-500 to-green-500 shadow-emerald-500/30 hover:shadow-emerald-500/40'
                }`}>
                {autoRunning ? <Icons.Stop /> : <Icons.Repeat />}
              </button>
              <button
                type="button"
                onClick={() => void onAutoGenerate()}
                disabled={disabled || autoRunning}
                title="AI 自动生成学生回答（仅本轮）"
                className="flex h-8 w-10 cursor-pointer items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 to-amber-500 text-white shadow-md shadow-orange-400/30 transition-all hover:shadow-orange-400/40 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none">
                <Icons.Sparkles />
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={disabled || autoRunning || !input.trim()}
                title="发送"
                className="flex h-8 w-10 cursor-pointer items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 text-white shadow-md shadow-blue-500/25 transition-all hover:shadow-blue-500/35 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none">
                <Icons.Send />
              </button>
            </div>
          </div>
          <p className="px-4 pb-3 text-xs text-slate-400">
            文字 → TTS → 音频帧；循环按钮开启全自动时，每轮 Bot 回复完自动生成学生回答
          </p>
        </div>
      )}
    </>
  );
};

// ============ 主组件 ============
const SidePanel = () => {
  const {
    trainTaskId,
    workflowState,
    messages,
    isLoading,
    dialogueRound,
    startConversation,
    sendMessage,
    autoGenerate,
    startAutoRun,
    stopAutoRun,
    isAutoRunning,
    scriptSteps,
    isStepListLoading,
    stepListError,
    fetchScriptSteps,
    runDebugStep,
    reset,
  } = useAgentChat();

  // 多角色 hook
  const multiRole = useMultiRoleRun(trainTaskId);

  // 口语训练 hook
  const voice = useVoiceAgentChat();

  // 训练模式：文字 / 口语
  const [mode, setMode] = useState<TrainingMode>('text');

  // 弹窗状态
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isConfigPromptOpen, setIsConfigPromptOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [isSimulationConfigOpen, setIsSimulationConfigOpen] = useState(false);
  const [isMultiRolePickerOpen, setIsMultiRolePickerOpen] = useState(false);
  const [simulationConfig, setSimulationConfig] = useState<SimulationModeState>(createSimulationModeState);
  const [historyInitialSessionId, setHistoryInitialSessionId] = useState<string | undefined>();

  const isIdle = workflowState === 'IDLE';
  const isChatting = workflowState === 'CHATTING';
  const isCompleted = workflowState === 'COMPLETED';

  useEffect(() => {
    let isMounted = true;

    const syncSimulationConfig = async () => {
      const config = await llmConfigStorage.get();
      if (!isMounted) {
        return;
      }

      setSimulationConfig({
        dialogueSimulationEnabled: config.dialogueSimulationEnabled,
        dialogueSimulationContent: config.dialogueSimulationContent,
        knowledgeBaseEnabled: config.knowledgeBaseEnabled,
        knowledgeBaseContent: config.knowledgeBaseContent,
      });
    };

    void syncSimulationConfig();
    const unsubscribe = llmConfigStorage.subscribe(() => {
      void syncSimulationConfig();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // 首次挂载时从存储恢复默认模式（用户可能希望默认进口语训练）
  const modeHydratedRef = useRef(false);
  useEffect(() => {
    if (modeHydratedRef.current) {
      return;
    }
    modeHydratedRef.current = true;
    llmConfigStorage
      .get()
      .then(config => {
        if (config.voiceModeEnabled) {
          setMode('voice');
        }
      })
      .catch(() => {
        // 忽略，仍保留默认文字模式
      });
  }, []);

  // 处理自动生成（检查是否需要配置）
  const handleAutoGenerate = async () => {
    if (isAutoRunning) {
      stopAutoRun();
    }
    const result = await autoGenerate();
    if (result.needConfig) {
      setIsConfigPromptOpen(true);
    }
  };

  const handleAutoRunToggle = async () => {
    if (isAutoRunning) {
      stopAutoRun();
      return;
    }
    const result = await startAutoRun();
    if (result.needConfig) {
      setIsConfigPromptOpen(true);
    }
  };

  useEffect(() => {
    if (!isDebugOpen) {
      return;
    }
    fetchScriptSteps();
  }, [fetchScriptSteps, isDebugOpen]);

  const handleSelectDebugStep = async (stepId: string) => {
    setIsDebugOpen(false);
    await runDebugStep(stepId);
  };

  const handleToggleDialogueSimulation = async (enabled: boolean) => {
    setSimulationConfig(prev => ({
      ...prev,
      dialogueSimulationEnabled: enabled,
    }));
    await llmConfigStorage.setConfig({ dialogueSimulationEnabled: enabled });
  };

  const handleToggleKnowledgeBase = async (enabled: boolean) => {
    setSimulationConfig(prev => ({
      ...prev,
      knowledgeBaseEnabled: enabled,
    }));
    await llmConfigStorage.setConfig({ knowledgeBaseEnabled: enabled });
  };

  // 多角色处理
  const handleMultiRoleConfirm = async (drafts: RoleRunDraft[]) => {
    await multiRole.startMultiRoleRun(drafts);
  };

  const handleMultiRoleAutoRun = async () => {
    if (multiRole.isBatchAutoRunning) {
      multiRole.stopBatchAutoRun();
      return;
    }
    const result = await multiRole.startBatchAutoRun();
    if (result.needConfig) {
      setIsConfigPromptOpen(true);
    }
  };

  const handleViewRoleHistory = (logSessionId: string) => {
    setHistoryInitialSessionId(logSessionId);
    setIsHistoryOpen(true);
  };

  const handleOpenHistory = () => {
    setHistoryInitialSessionId(undefined);
    setIsHistoryOpen(true);
  };

  const handleResetAll = () => {
    if (multiRole.isMultiRoleMode) {
      multiRole.resetMultiRole();
    }
    reset();
    voice.reset();
  };

  const handleChangeMode = (nextMode: TrainingMode) => {
    if (nextMode === mode) {
      return;
    }
    // 切换模式前清理两侧的状态，避免遗留会话
    if (multiRole.isMultiRoleMode) {
      multiRole.resetMultiRole();
    }
    reset();
    voice.reset();
    setMode(nextMode);
    void llmConfigStorage.setConfig({ voiceModeEnabled: nextMode === 'voice' });
  };

  const handleVoiceAutoGenerate = async () => {
    const result = await voice.autoGenerate();
    if (result.needConfig) {
      setIsConfigPromptOpen(true);
    }
  };

  const handleVoiceAutoRunToggle = async () => {
    if (voice.isAutoRunning) {
      voice.stopAutoRun();
      return;
    }
    const result = await voice.startAutoRun();
    if (result.needConfig) {
      setIsConfigPromptOpen(true);
    }
  };

  const voiceBusy = voice.voiceState !== 'IDLE' && voice.voiceState !== 'COMPLETED' && voice.voiceState !== 'ERROR';
  const textBusy = workflowState !== 'IDLE' || multiRole.isMultiRoleMode;
  const modeToggleDisabled = mode === 'text' ? textBusy : voiceBusy;
  const canStartVoice = voice.voiceState === 'IDLE' || voice.voiceState === 'ERROR';
  const voiceStateLabel: Record<typeof voice.voiceState, string> = {
    IDLE: '未连接',
    CONNECTING: '连接中',
    CONNECTED: '已就绪',
    SENDING_AUDIO: '发送音频',
    WAITING_SERVER: '等待服务端',
    BOT_SPEAKING: 'Bot 回复中',
    COMPLETED: '已完成',
    ERROR: '异常',
  };

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      {/* 头部 */}
      {mode === 'voice' ? (
        <Header
          trainTaskId={voice.trainTaskId ?? trainTaskId}
          trainTaskName={voice.trainTaskName}
          workflowState={
            voice.voiceState === 'COMPLETED'
              ? 'COMPLETED'
              : voice.voiceState === 'ERROR'
                ? 'ERROR'
                : voice.voiceState === 'IDLE'
                  ? 'IDLE'
                  : 'CHATTING'
          }
          dialogueRound={voice.dialogueRound}
          onReset={handleResetAll}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenHistory={handleOpenHistory}
          mode={mode}
          onChangeMode={handleChangeMode}
          modeToggleDisabled={modeToggleDisabled}
        />
      ) : (
        <Header
          trainTaskId={trainTaskId}
          workflowState={multiRole.isMultiRoleMode ? 'CHATTING' : workflowState}
          dialogueRound={multiRole.isMultiRoleMode ? 0 : dialogueRound}
          onReset={handleResetAll}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenHistory={handleOpenHistory}
          mode={mode}
          onChangeMode={handleChangeMode}
          modeToggleDisabled={modeToggleDisabled}
        />
      )}

      {/* 内容区：口语 vs 多角色 vs 单角色 */}
      {mode === 'voice' ? (
        <VoiceChatArea
          voice={voice}
          voiceStateLabel={voiceStateLabel[voice.voiceState]}
          canStart={canStartVoice}
          onStart={voice.startSession}
          onAutoGenerate={handleVoiceAutoGenerate}
          onAutoRunToggle={handleVoiceAutoRunToggle}
          trainTaskId={voice.trainTaskId ?? trainTaskId}
        />
      ) : multiRole.isMultiRoleMode && multiRole.batch ? (
        <>
          <MultiRoleView
            batch={multiRole.batch}
            isLoading={multiRole.isLoading}
            isBatchAutoRunning={multiRole.isBatchAutoRunning}
            onSetActiveRole={multiRole.setActiveRoleIndex}
            onViewHistory={handleViewRoleHistory}
          />
          <MultiRoleChatInput
            onSend={content => {
              void multiRole.sendToActiveRole(content);
            }}
            onAutoRun={() => {
              void handleMultiRoleAutoRun();
            }}
            onStopAutoRun={multiRole.stopBatchAutoRun}
            isAutoRunning={multiRole.isBatchAutoRunning}
            onReset={multiRole.resetMultiRole}
            disabled={
              multiRole.isLoading ||
              multiRole.batch.batchState === 'COMPLETED' ||
              multiRole.batch.batchState === 'ERROR'
            }
            activeRoleLabel={
              multiRole.batch.activeRoleIndex >= 0
                ? (multiRole.batch.roles[multiRole.batch.activeRoleIndex]?.profileLabel ?? null)
                : null
            }
          />
        </>
      ) : (
        <>
          {/* 消息列表 */}
          <MessageList messages={messages} isLoading={isLoading} />

          {/* 底部操作区 */}
          {isIdle ? (
            <StartButton onClick={startConversation} disabled={isLoading} trainTaskId={trainTaskId} />
          ) : isChatting || isCompleted ? (
            <ChatInput
              onSend={sendMessage}
              onAutoGenerate={handleAutoGenerate}
              onAutoRun={handleAutoRunToggle}
              onStopAutoRun={stopAutoRun}
              isAutoRunning={isAutoRunning}
              onOpenDebug={() => setIsDebugOpen(true)}
              onOpenSimulationConfig={() => setIsSimulationConfigOpen(true)}
              onOpenMultiRole={() => setIsMultiRolePickerOpen(true)}
              simulationConfig={simulationConfig}
              onToggleDialogueSimulation={enabled => {
                void handleToggleDialogueSimulation(enabled);
              }}
              onToggleKnowledgeBase={enabled => {
                void handleToggleKnowledgeBase(enabled);
              }}
              toggleDisabled={isLoading}
              debugDisabled={isLoading}
              disabled={isLoading || isCompleted}
            />
          ) : (
            <div className="flex items-center justify-center gap-3 border-t border-slate-200 bg-white p-5 text-slate-500">
              <Icons.Loader />
              <span className="text-sm">正在处理中...</span>
            </div>
          )}
        </>
      )}

      {/* 设置弹窗 */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* 配置提示弹窗 */}
      <ConfigPromptModal
        isOpen={isConfigPromptOpen}
        onClose={() => setIsConfigPromptOpen(false)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <DebugStepsModal
        isOpen={isDebugOpen}
        steps={scriptSteps}
        isLoading={isStepListLoading}
        error={stepListError}
        onClose={() => setIsDebugOpen(false)}
        onRefresh={() => fetchScriptSteps({ force: true })}
        onSelectStep={handleSelectDebugStep}
      />

      <SimulationConfigModal
        isOpen={isSimulationConfigOpen}
        onClose={() => setIsSimulationConfigOpen(false)}
        trainTaskId={trainTaskId}
        onOpenMultiRole={() => {
          setIsSimulationConfigOpen(false);
          setIsMultiRolePickerOpen(true);
        }}
      />

      <MultiRolePickerModal
        isOpen={isMultiRolePickerOpen}
        onClose={() => setIsMultiRolePickerOpen(false)}
        onConfirm={drafts => {
          void handleMultiRoleConfirm(drafts);
        }}
      />

      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => {
          setIsHistoryOpen(false);
          setHistoryInitialSessionId(undefined);
        }}
        initialSessionId={historyInitialSessionId}
      />
    </div>
  );
};

export default SidePanel;
