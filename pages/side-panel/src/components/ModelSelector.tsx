import { groupModelOptions } from './model-brand';
import { ModelBrandIcon } from './ModelBrandIcon';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

interface ModelOption {
  value: string;
  label: string;
}

interface ModelSelectorProps {
  options: ModelOption[];
  value: string;
  onChange: (value: string) => void;
  labelId?: string;
}

const ChevronIcon = ({ isOpen }: { isOpen: boolean }) => (
  <svg
    aria-hidden="true"
    className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
    fill="none"
    viewBox="0 0 24 24">
    <path d="m7 10 5 5 5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  </svg>
);

const CheckIcon = () => (
  <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
    <path d="m5 12 4 4L19 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  </svg>
);

const ModelSelector = ({ options, value, onChange, labelId }: ModelSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const componentId = useId().replaceAll(':', '');
  const listboxId = `model-selector-${componentId}`;
  const groupedOptions = useMemo(() => groupModelOptions(options), [options]);
  const flatOptions = useMemo(() => groupedOptions.flatMap(group => group.options), [groupedOptions]);
  const selectedOption = options.find(option => option.value === value);
  const selectedLabel = selectedOption?.label ?? value;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    optionRefs.current[activeIndex]?.focus();
  }, [activeIndex, isOpen]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const openSelector = (preferredIndex?: number) => {
    const selectedIndex = flatOptions.findIndex(option => option.value === value);
    const nextIndex = preferredIndex ?? (selectedIndex >= 0 ? selectedIndex : 0);
    setActiveIndex(Math.max(0, Math.min(nextIndex, flatOptions.length - 1)));
    setIsOpen(true);
  };

  const closeSelector = (restoreFocus = false) => {
    setIsOpen(false);
    if (restoreFocus) {
      triggerRef.current?.focus();
    }
  };

  const selectOption = (option: ModelOption) => {
    onChange(option.value);
    closeSelector(true);
  };

  const moveActiveOption = (nextIndex: number) => {
    const optionCount = flatOptions.length;
    if (optionCount === 0) {
      return;
    }

    setActiveIndex((nextIndex + optionCount) % optionCount);
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const selectedIndex = flatOptions.findIndex(option => option.value === value);
      const fallbackIndex = event.key === 'ArrowDown' ? 0 : flatOptions.length - 1;
      openSelector(selectedIndex >= 0 ? selectedIndex : fallbackIndex);
      return;
    }

    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      closeSelector();
    }
  };

  const handleOptionKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, option: ModelOption) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveActiveOption(activeIndex + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveActiveOption(activeIndex - 1);
        break;
      case 'Home':
        event.preventDefault();
        moveActiveOption(0);
        break;
      case 'End':
        event.preventDefault();
        moveActiveOption(flatOptions.length - 1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        selectOption(option);
        break;
      case 'Escape':
        event.preventDefault();
        closeSelector(true);
        break;
      case 'Tab':
        closeSelector();
        break;
      default:
        break;
    }
  };

  let optionIndex = -1;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={labelId ? undefined : '选择模型'}
        aria-labelledby={labelId}
        onClick={() => (isOpen ? closeSelector() : openSelector())}
        onKeyDown={handleTriggerKeyDown}
        className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-sm transition-all hover:border-slate-300 focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100">
        <ModelBrandIcon modelId={value} size={19} />
        <span className="min-w-0 flex-1 truncate text-slate-700">{selectedLabel || '请选择一个文本模型'}</span>
        <span className="flex-shrink-0 text-slate-400">
          <ChevronIcon isOpen={isOpen} />
        </span>
      </button>

      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="可用文本模型"
          className="absolute inset-x-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl">
          {groupedOptions.map(group => {
            const groupId = `${listboxId}-${group.provider}`;
            return (
              <div key={group.provider} role="group" aria-labelledby={groupId}>
                <div
                  id={groupId}
                  className="sticky top-0 bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-slate-400 backdrop-blur-sm">
                  {group.groupLabel}
                </div>
                {group.options.map(option => {
                  optionIndex += 1;
                  const currentIndex = optionIndex;
                  const isSelected = option.value === value;
                  const showsModelId = option.label !== option.value;

                  return (
                    <button
                      key={option.value}
                      ref={element => {
                        optionRefs.current[currentIndex] = element;
                      }}
                      id={`${listboxId}-option-${currentIndex}`}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      tabIndex={currentIndex === activeIndex ? 0 : -1}
                      onClick={() => selectOption(option)}
                      onFocus={() => setActiveIndex(currentIndex)}
                      onKeyDown={event => handleOptionKeyDown(event, option)}
                      className={`flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left transition-colors focus:outline-none ${
                        isSelected ? 'bg-cyan-50 text-cyan-800' : 'text-slate-700 hover:bg-slate-50 focus:bg-slate-50'
                      }`}>
                      <ModelBrandIcon modelId={option.value} size={19} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{option.label}</span>
                        {showsModelId && (
                          <span className="block truncate text-[11px] text-slate-400">{option.value}</span>
                        )}
                      </span>
                      <span className={`flex-shrink-0 ${isSelected ? 'text-cyan-600' : 'text-transparent'}`}>
                        <CheckIcon />
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export { ModelSelector };
export type { ModelOption };
