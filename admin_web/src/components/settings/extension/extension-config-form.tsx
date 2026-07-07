import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { getMyLlmConfig, saveMyLlmConfig } from '@/api/extension-config';
import { defaultLlmConfig, llmConfigSchema, type LlmConfigInput } from '@/lib/llm-config-schema';

type FieldDef = {
  name: keyof LlmConfigInput;
  label: string;
  type: 'text' | 'password' | 'number' | 'textarea' | 'checkbox';
};

// 仅列出适合直接表单编辑的字段；studentProfiles 用 JSON 文本编辑（见下）。
const FIELDS: FieldDef[] = [
  { name: 'apiKey', label: 'API Key', type: 'password' },
  { name: 'apiUrl', label: 'Base URL', type: 'text' },
  { name: 'model', label: '模型', type: 'text' },
  { name: 'systemPrompt', label: '系统提示词', type: 'textarea' },
  { name: 'dialogueSimulationContent', label: '模拟对话内容', type: 'textarea' },
  { name: 'knowledgeBaseContent', label: '知识库内容', type: 'textarea' },
];

export function ExtensionConfigForm() {
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profilesText, setProfilesText] = useState('[]');
  const { register, handleSubmit, reset, setValue } = useForm<LlmConfigInput>({
    resolver: zodResolver(llmConfigSchema),
    defaultValues: defaultLlmConfig,
  });

  useEffect(() => {
    getMyLlmConfig().then(({ config }) => {
      const value = config ?? defaultLlmConfig;
      reset(value);
      setProfilesText(JSON.stringify(value.studentProfiles, null, 2));
      setLoaded(true);
    });
  }, [reset]);

  const onSubmit = async (data: LlmConfigInput) => {
    setSaved(false);
    await saveMyLlmConfig({ data });
    setSaved(true);
  };

  if (!loaded) {
    return <p className="text-muted-foreground text-sm">加载中…</p>;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex max-w-xl flex-col gap-4">
      {FIELDS.map(f => (
        <div key={f.name} className="flex flex-col gap-1">
          <label htmlFor={f.name} className="text-sm font-medium">
            {f.label}
          </label>
          {f.type === 'textarea' ? (
            <textarea id={f.name} className="min-h-24 rounded-md border px-3 py-2 text-sm" {...register(f.name)} />
          ) : (
            <input
              id={f.name}
              type={f.type}
              className="rounded-md border px-3 py-2 text-sm"
              {...register(f.name, {
                valueAsNumber: f.type === 'number',
              })}
            />
          )}
        </div>
      ))}

      <div className="flex flex-col gap-1">
        <label htmlFor="studentProfiles" className="text-sm font-medium">
          学生档位（JSON 数组）
        </label>
        <textarea
          id="studentProfiles"
          className="min-h-40 rounded-md border px-3 py-2 font-mono text-xs"
          value={profilesText}
          onChange={e => {
            setProfilesText(e.target.value);
            try {
              setValue('studentProfiles', JSON.parse(e.target.value));
            } catch {
              // 非法 JSON 暂不更新表单值，提交时由 zod 校验拦截
            }
          }}
        />
        <p className="text-muted-foreground text-xs">每项：{'{ id, label, description, style, fallbackHint }'}</p>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium">
          保存
        </button>
        {saved && <span className="text-sm text-emerald-600">已保存</span>}
      </div>
    </form>
  );
}
