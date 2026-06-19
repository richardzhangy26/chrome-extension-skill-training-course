import { getModelBrand } from './model-brand';
import { Claude, DeepSeek, Doubao, Gemini, Grok, OpenAI, Qwen } from '@lobehub/icons';
import type { ModelProvider } from './model-brand';
import type { IconType } from '@lobehub/icons';

interface ModelBrandIconProps {
  modelId: string;
  size?: number;
  className?: string;
}

const MODEL_BRAND_ICONS: Partial<Record<ModelProvider, IconType>> = {
  doubao: Doubao.Color,
  deepseek: DeepSeek.Color,
  qwen: Qwen.Color,
  openai: OpenAI,
  gemini: Gemini.Color,
  claude: Claude.Color,
  grok: Grok,
};

const GenericModelIcon = ({ size = 18, className }: Omit<ModelBrandIconProps, 'modelId'>) => (
  <svg aria-hidden="true" className={className} fill="none" height={size} viewBox="0 0 24 24" width={size}>
    <path
      d="M12 2.75 4.5 7v10l7.5 4.25L19.5 17V7L12 2.75Z"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
    <path d="m4.75 7.2 7.25 4.1 7.25-4.1M12 11.3v9.4" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

const ModelBrandIcon = ({ modelId, size = 18, className }: ModelBrandIconProps) => {
  const { provider } = getModelBrand(modelId);
  const BrandIcon = MODEL_BRAND_ICONS[provider];

  if (!BrandIcon) {
    return <GenericModelIcon className={className} size={size} />;
  }

  return <BrandIcon aria-hidden="true" className={className} size={size} />;
};

export { ModelBrandIcon };
