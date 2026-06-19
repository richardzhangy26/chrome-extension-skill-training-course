type ModelProvider = 'doubao' | 'deepseek' | 'qwen' | 'openai' | 'gemini' | 'claude' | 'grok' | 'other';

interface ModelBrand {
  provider: ModelProvider;
  groupLabel: string;
}

interface ModelOptionLike {
  value: string;
}

interface ModelGroup<T extends ModelOptionLike> extends ModelBrand {
  options: T[];
}

interface ModelBrandDefinition extends ModelBrand {
  matches: (modelId: string) => boolean;
}

const MODEL_BRAND_DEFINITIONS: ModelBrandDefinition[] = [
  {
    provider: 'doubao',
    groupLabel: '豆包',
    matches: modelId => /doubao/i.test(modelId),
  },
  {
    provider: 'deepseek',
    groupLabel: 'DeepSeek',
    matches: modelId => /deep[\s_-]?seek/i.test(modelId),
  },
  {
    provider: 'qwen',
    groupLabel: '通义千问',
    matches: modelId => /qwen|qwq|tongyi/i.test(modelId),
  },
  {
    provider: 'openai',
    groupLabel: 'OpenAI',
    matches: modelId => /openai|chatgpt|(^|[/_.-])gpt([/_.-]|$)|(^|[/_.-])o[134]([/_.-]|$)/i.test(modelId),
  },
  {
    provider: 'gemini',
    groupLabel: 'Gemini',
    matches: modelId => /gemini/i.test(modelId),
  },
  {
    provider: 'claude',
    groupLabel: 'Claude',
    matches: modelId => /claude/i.test(modelId),
  },
  {
    provider: 'grok',
    groupLabel: 'Grok',
    matches: modelId => /grok|(^|[/_.\s-])x[-_ ]?ai([/_.\s-]|$)/i.test(modelId),
  },
];

const OTHER_MODEL_BRAND: ModelBrand = {
  provider: 'other',
  groupLabel: '其他',
};

const getModelBrand = (modelId: string): ModelBrand => {
  const normalizedModelId = modelId.trim();
  const definition = MODEL_BRAND_DEFINITIONS.find(item => item.matches(normalizedModelId));

  return definition ?? OTHER_MODEL_BRAND;
};

const groupModelOptions = <T extends ModelOptionLike>(options: T[]): ModelGroup<T>[] => {
  const groupedOptions = new Map<ModelProvider, T[]>();

  for (const option of options) {
    const { provider } = getModelBrand(option.value);
    groupedOptions.set(provider, [...(groupedOptions.get(provider) ?? []), option]);
  }

  const groupOrder = [...MODEL_BRAND_DEFINITIONS, OTHER_MODEL_BRAND];
  return groupOrder.flatMap(brand => {
    const groupOptions = groupedOptions.get(brand.provider);
    return groupOptions?.length ? [{ ...brand, options: groupOptions }] : [];
  });
};

export { getModelBrand, groupModelOptions };
export type { ModelBrand, ModelGroup, ModelOptionLike, ModelProvider };
