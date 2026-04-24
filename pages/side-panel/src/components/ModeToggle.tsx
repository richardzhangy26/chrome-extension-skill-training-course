/**
 * 模式切换按钮：文字训练 ↔ 口语训练
 * 对齐 Header 的 bg-white/15 backdrop-blur-sm 视觉
 */
import type { FC } from 'react';

type TrainingMode = 'text' | 'voice';

interface ModeToggleProps {
  mode: TrainingMode;
  onChange: (mode: TrainingMode) => void;
  disabled?: boolean;
}

const TextIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const VoiceIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

const ModeToggle: FC<ModeToggleProps> = ({ mode, onChange, disabled = false }) => {
  const isText = mode === 'text';
  const handleFlip = () => {
    if (disabled) return;
    onChange(isText ? 'voice' : 'text');
  };
  const label = isText ? '切到口语' : '切到文字';
  const title = disabled ? '训练进行中，先重置后再切换' : label;

  return (
    <button
      type="button"
      onClick={handleFlip}
      disabled={disabled}
      aria-label={label}
      title={title}
      className={`flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1.5 text-xs text-white/90 backdrop-blur-sm transition-all duration-200 hover:bg-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-white/15`}>
      {isText ? <TextIcon /> : <VoiceIcon />}
      <span>{isText ? '文字' : '口语'}</span>
    </button>
  );
};

export { ModeToggle };
export type { TrainingMode };
