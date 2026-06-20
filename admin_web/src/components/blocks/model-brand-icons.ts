import ClaudeColor from '@lobehub/icons/es/Claude/components/Color';
import DoubaoColor from '@lobehub/icons/es/Doubao/components/Color';
import GeminiColor from '@lobehub/icons/es/Gemini/components/Color';
import OpenAI from '@lobehub/icons/es/OpenAI/components/Mono';
import QwenColor from '@lobehub/icons/es/Qwen/components/Color';
import WenxinColor from '@lobehub/icons/es/Wenxin/components/Color';
import type { IconType } from '@lobehub/icons/es/types';

interface ModelBrandIcon {
  id: 'doubao' | 'openai' | 'gemini' | 'claude' | 'qwen' | 'wenxin';
  label: string;
  Icon: IconType;
  iconClassName?: string;
}

const MODEL_BRAND_ICONS = [
  { id: 'doubao', label: '豆包', Icon: DoubaoColor },
  {
    id: 'openai',
    label: 'GPT-4o',
    Icon: OpenAI,
    iconClassName: 'text-foreground',
  },
  { id: 'gemini', label: 'Gemini', Icon: GeminiColor },
  { id: 'claude', label: 'Claude', Icon: ClaudeColor },
  { id: 'qwen', label: '通义千问', Icon: QwenColor },
  { id: 'wenxin', label: '文心一言', Icon: WenxinColor },
] as const satisfies readonly ModelBrandIcon[];

const FEATURED_MODEL_BRAND_ICONS = MODEL_BRAND_ICONS.filter(brand => brand.id !== 'wenxin');

export { FEATURED_MODEL_BRAND_ICONS, MODEL_BRAND_ICONS };
export type { ModelBrandIcon };
