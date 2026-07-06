/**
 * 多角色 P1：单角色运行时配置编辑器
 */

import { useEffect, useState } from 'react';
import type { RoleRuntimeConfig } from '../types/multi-role-types';

interface RoleRuntimeConfigEditorProps {
  value: RoleRuntimeConfig | null;
  onChange: (value: RoleRuntimeConfig | null) => void;
  readOnly?: boolean;
}

const EMPTY_CONFIG: RoleRuntimeConfig = {
  dialogueSimulationEnabled: false,
  dialogueSimulationContent: '',
  knowledgeBaseEnabled: false,
  knowledgeBaseContent: '',
};

const RoleRuntimeConfigEditor = ({ value, onChange, readOnly = false }: RoleRuntimeConfigEditorProps) => {
  const [draft, setDraft] = useState<RoleRuntimeConfig>(value ?? EMPTY_CONFIG);

  useEffect(() => {
    setDraft(value ?? EMPTY_CONFIG);
  }, [value]);

  const update = (patch: Partial<RoleRuntimeConfig>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    onChange(next);
  };

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={draft.dialogueSimulationEnabled}
          disabled={readOnly}
          onChange={event => update({ dialogueSimulationEnabled: event.target.checked })}
        />
        <span className="font-medium text-slate-700">使用独立对话剧本</span>
      </label>
      {draft.dialogueSimulationEnabled && (
        <textarea
          value={draft.dialogueSimulationContent}
          disabled={readOnly}
          onChange={event => update({ dialogueSimulationContent: event.target.value })}
          placeholder="按 AI: / 用户: 格式粘贴该角色的专属历史对话"
          rows={4}
          className="w-full resize-y rounded-md border border-slate-200 bg-white px-2 py-1.5 text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100"
        />
      )}

      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={draft.knowledgeBaseEnabled}
          disabled={readOnly}
          onChange={event => update({ knowledgeBaseEnabled: event.target.checked })}
        />
        <span className="font-medium text-slate-700">使用独立知识库</span>
      </label>
      {draft.knowledgeBaseEnabled && (
        <textarea
          value={draft.knowledgeBaseContent}
          disabled={readOnly}
          onChange={event => update({ knowledgeBaseContent: event.target.value })}
          placeholder="该角色的专属参考知识"
          rows={4}
          className="w-full resize-y rounded-md border border-slate-200 bg-white px-2 py-1.5 text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100"
        />
      )}
    </div>
  );
};

export { RoleRuntimeConfigEditor };
