import { m } from '@/locale/paraglide/messages';
import { useEffect, useState } from 'react';
import { getMyLlmConfig } from '@/api/extension-config';
import { defaultLlmConfig, type LlmConfigInput } from '@/lib/llm-config-schema';

type FieldDef = {
  name: keyof LlmConfigInput;
  label: () => string;
  type: 'text' | 'password' | 'textarea';
};

// 只读展示：配置的编辑入口在插件，网页仅供查看。
const FIELDS: FieldDef[] = [
  { name: 'apiKey', label: m.settings_extension_api_key, type: 'password' },
  { name: 'apiUrl', label: m.settings_extension_base_url, type: 'text' },
  { name: 'model', label: m.settings_extension_model, type: 'text' },
  {
    name: 'systemPrompt',
    label: m.settings_extension_system_prompt,
    type: 'textarea',
  },
  {
    name: 'dialogueSimulationContent',
    label: m.settings_extension_dialogue_simulation_content,
    type: 'textarea',
  },
  {
    name: 'knowledgeBaseContent',
    label: m.settings_extension_knowledge_base_content,
    type: 'textarea',
  },
];

export function ExtensionConfigForm() {
  const [loaded, setLoaded] = useState(false);
  const [config, setConfig] = useState<LlmConfigInput>(defaultLlmConfig);

  useEffect(() => {
    getMyLlmConfig().then(({ config }) => {
      setConfig(config ?? defaultLlmConfig);
      setLoaded(true);
    });
  }, []);

  if (!loaded) {
    return <p className="text-muted-foreground text-sm">{m.common_loading()}</p>;
  }

  const profilesText = JSON.stringify(config.studentProfiles, null, 2);

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <div className="rounded-md border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-800">
        {m.settings_extension_config_note()}
      </div>
      {FIELDS.map(f => {
        const value = (config[f.name] as string) ?? '';
        return (
          <div key={f.name} className="flex flex-col gap-1">
            <label htmlFor={f.name} className="text-sm font-medium">
              {f.label()}
            </label>
            {f.type === 'textarea' ? (
              <textarea
                id={f.name}
                readOnly
                value={value}
                className="bg-muted min-h-24 rounded-md border px-3 py-2 text-sm"
              />
            ) : (
              <input
                id={f.name}
                type={f.type}
                readOnly
                value={value}
                className="bg-muted rounded-md border px-3 py-2 text-sm"
              />
            )}
          </div>
        );
      })}

      <div className="flex flex-col gap-1">
        <label htmlFor="studentProfiles" className="text-sm font-medium">
          {m.settings_extension_student_profiles()}
        </label>
        <textarea
          id="studentProfiles"
          readOnly
          value={profilesText}
          className="bg-muted min-h-40 rounded-md border px-3 py-2 font-mono text-xs"
        />
      </div>
    </div>
  );
}
