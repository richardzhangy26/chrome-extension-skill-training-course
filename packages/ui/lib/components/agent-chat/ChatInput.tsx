import { cn } from '../../utils.js';
import { useState, useCallback } from 'react';
import type { KeyboardEvent } from 'react';

export interface ChatInputProps {
  onSend: (content: string) => void;
  onAutoGenerate: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export const ChatInput = ({
  onSend,
  onAutoGenerate,
  disabled = false,
  placeholder = '输入回答...',
}: ChatInputProps) => {
  const [value, setValue] = useState('');

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed) {
      onSend(trimmed);
      setValue('');
    }
  }, [value, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter') {
        if (e.ctrlKey || e.metaKey) {
          // Ctrl+Enter 或 Cmd+Enter: 发送消息
          e.preventDefault();
          handleSend();
        } else if (!e.shiftKey && !value.trim()) {
          // 回车且输入为空: AI自动生成
          e.preventDefault();
          onAutoGenerate();
        } else if (!e.shiftKey && value.trim()) {
          // 回车且有内容: 发送消息
          e.preventDefault();
          handleSend();
        }
        // Shift+Enter: 换行（默认行为）
      }
    },
    [value, handleSend, onAutoGenerate],
  );

  return (
    <div className="border-t border-gray-200 bg-white p-3">
      {/* 输入区域 */}
      <div className="flex items-end gap-2">
        <textarea
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          rows={2}
          className={cn(
            'flex-1 resize-none rounded-xl border border-gray-300 px-4 py-2',
            'focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500',
            'disabled:cursor-not-allowed disabled:bg-gray-100',
            'text-sm',
          )}
        />

        {/* 按钮组 */}
        <div className="flex flex-col gap-1">
          {/* AI自动回答按钮 */}
          <button
            onClick={onAutoGenerate}
            disabled={disabled}
            title="AI自动回答"
            className={cn(
              'rounded-lg p-2 transition-colors',
              'bg-purple-500 text-white hover:bg-purple-600',
              'disabled:cursor-not-allowed disabled:bg-gray-300',
            )}>
            🤖
          </button>

          {/* 发送按钮 */}
          <button
            onClick={handleSend}
            disabled={disabled || !value.trim()}
            title="发送消息"
            className={cn(
              'rounded-lg p-2 transition-colors',
              'bg-blue-500 text-white hover:bg-blue-600',
              'disabled:cursor-not-allowed disabled:bg-gray-300',
            )}>
            📤
          </button>
        </div>
      </div>

      {/* 快捷键提示 */}
      <div className="mt-2 text-center text-xs text-gray-400">
        💡 回车=发送 | 空输入+回车=AI自动回答 | Shift+回车=换行
      </div>
    </div>
  );
};
