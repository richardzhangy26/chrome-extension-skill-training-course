/**
 * 训练模式下拉框：能力训练 / 口语训练 / 能力训练 Pro
 * 对齐 Header 的 bg-white/15 backdrop-blur-sm 视觉
 */
import { useEffect, useId, useRef, useState } from 'react';
import type { FC } from 'react';

type TrainingMode = 'text' | 'voice' | 'pro';

interface ModeToggleProps {
  mode: TrainingMode;
  onChange: (mode: TrainingMode) => void;
  disabled?: boolean;
}

interface ModeOption {
  value: TrainingMode;
  label: string;
  icon: 'text' | 'voice' | 'pro';
}

const MODE_OPTIONS: ModeOption[] = [
  { value: 'text', label: '能力训练', icon: 'text' },
  { value: 'voice', label: '口语训练', icon: 'voice' },
  { value: 'pro', label: '能力训练 Pro', icon: 'pro' },
];

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

const ProIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
    <path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z" />
    <path d="m18.5 14 .7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3Z" />
  </svg>
);

const ChevronIcon = ({ isOpen }: { isOpen: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
    <path d="m5 12 4 4L19 6" />
  </svg>
);

const ModeIcon = ({ icon }: Pick<ModeOption, 'icon'>) => {
  if (icon === 'voice') {
    return <VoiceIcon />;
  }
  if (icon === 'pro') {
    return <ProIcon />;
  }
  return <TextIcon />;
};

const ModeToggle: FC<ModeToggleProps> = ({ mode, onChange, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const selectedOption = MODE_OPTIONS.find(option => option.value === mode) ?? MODE_OPTIONS[0];
  const title = disabled ? '训练进行中，先重置后再切换' : `当前模式：${selectedOption.label}`;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (nextMode: TrainingMode) => {
    if (nextMode !== mode) {
      onChange(nextMode);
    }
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative z-20">
      <button
        type="button"
        onClick={() => setIsOpen(current => !current)}
        disabled={disabled}
        aria-label="选择训练模式"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        title={title}
        className="flex min-w-[7.25rem] cursor-pointer items-center justify-between gap-1.5 rounded-lg bg-white/15 px-2.5 py-1.5 text-xs text-white/90 backdrop-blur-sm transition-all duration-200 hover:bg-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-white/15">
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <ModeIcon icon={selectedOption.icon} />
          <span>{selectedOption.label}</span>
        </span>
        <ChevronIcon isOpen={isOpen} />
      </button>

      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="训练模式"
          className="absolute left-0 top-full mt-1.5 w-40 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-slate-700 shadow-xl">
          {MODE_OPTIONS.map(option => {
            const isSelected = option.value === mode;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(option.value)}
                className={`flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${
                  isSelected ? 'bg-blue-50 font-medium text-blue-700' : 'hover:bg-slate-50 hover:text-slate-900'
                }`}>
                <ModeIcon icon={option.icon} />
                <span className="flex-1 whitespace-nowrap">{option.label}</span>
                {isSelected && <CheckIcon />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export { ModeToggle };
export type { TrainingMode };
