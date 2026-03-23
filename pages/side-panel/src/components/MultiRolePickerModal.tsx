/**
 * 多角色选择弹窗
 * 从 studentProfiles 中多选角色，确认后触发多人运行
 */

import { MAX_MULTI_ROLE_COUNT } from '../types/multi-role-types';
import { llmConfigStorage } from '@extension/storage';
import { useEffect, useState } from 'react';
import type { RoleRunDraft } from '../types/multi-role-types';
import type { StudentProfile } from '@extension/storage';

interface MultiRolePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (drafts: RoleRunDraft[]) => void;
}

const MultiRolePickerModal = ({ isOpen, onClose, onConfirm }: MultiRolePickerModalProps) => {
  const [profiles, setProfiles] = useState<StudentProfile[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const loadProfiles = async () => {
      const config = await llmConfigStorage.get();
      if (!isMounted) return;
      setProfiles(config.studentProfiles);
      setSelectedIds(new Set());
    };
    void loadProfiles();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_MULTI_ROLE_COUNT) {
        next.add(id);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const drafts: RoleRunDraft[] = profiles
      .filter(p => selectedIds.has(p.id))
      .map(p => ({ profileId: p.id, profileLabel: p.label }));
    if (drafts.length > 0) {
      onConfirm(drafts);
      onClose();
    }
  };

  const isAtLimit = selectedIds.size >= MAX_MULTI_ROLE_COUNT;

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

      <div className="relative flex max-h-[80vh] w-[88%] max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-violet-600 to-indigo-500 px-5 py-4 text-white">
          <div>
            <h2 className="text-lg font-semibold">选择角色并行运行</h2>
            <p className="mt-1 text-xs text-white/80">
              已选 {selectedIds.size} 个，最多 {MAX_MULTI_ROLE_COUNT} 个
            </p>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1 text-white/80 transition-colors hover:bg-white/20 hover:text-white">
            <span className="text-xl leading-none">×</span>
          </button>
        </div>

        {/* 角色列表 */}
        <div className="flex-1 overflow-y-auto bg-slate-50 p-4">
          {profiles.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">暂无可用角色，请先在设置中配置学生档位。</p>
          ) : (
            <div className="space-y-2">
              {profiles.map(profile => {
                const isSelected = selectedIds.has(profile.id);
                const isDisabled = !isSelected && isAtLimit;

                return (
                  <label
                    key={profile.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-all ${
                      isSelected
                        ? 'border-indigo-400 bg-white shadow-sm'
                        : isDisabled
                          ? 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-50'
                          : 'border-slate-200 bg-white hover:border-indigo-200 hover:shadow-sm'
                    }`}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isDisabled}
                      onChange={() => handleToggle(profile.id)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:cursor-not-allowed"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-800">{profile.label}</div>
                      {profile.description && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{profile.description}</p>
                      )}
                      {profile.style && <p className="mt-0.5 text-xs text-slate-400">风格: {profile.style}</p>}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex gap-3 border-t border-slate-200 bg-white px-5 py-4">
          <button
            onClick={onClose}
            className="flex-1 cursor-pointer rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100">
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedIds.size === 0}
            className="flex-1 cursor-pointer rounded-lg bg-gradient-to-r from-violet-600 to-indigo-500 py-2.5 text-sm font-medium text-white transition-all hover:from-violet-700 hover:to-indigo-600 disabled:cursor-not-allowed disabled:opacity-50">
            开始运行 ({selectedIds.size})
          </button>
        </div>
      </div>
    </div>
  );
};

export { MultiRolePickerModal };
