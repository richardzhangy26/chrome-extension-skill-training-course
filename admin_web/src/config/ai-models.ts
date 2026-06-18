export const WORKERS_AI_MODELS = {
  summarization: '@cf/meta/llama-3.2-3b-instruct',
  tagline: '@cf/meta/llama-3.2-3b-instruct',
  translation: '@cf/meta/m2m100-1.2b',
  textToSpeech: '@cf/deepgram/aura-1',
  imageCaption: '@cf/llava-hf/llava-1.5-7b-hf',
} as const;

export const CF_IMAGE_MODELS = [
  '@cf/black-forest-labs/flux-1-schnell',
  '@cf/bytedance/stable-diffusion-xl-lightning',
  '@cf/lykon/dreamshaper-8-lcm',
] as const;

export const DEFAULT_CF_IMAGE_MODEL = CF_IMAGE_MODELS[0];

export const FAL_IMAGE_MODELS = [
  'fal-ai/flux/schnell',
  'fal-ai/nano-banana',
  'openai/gpt-image-2',
] as const;

export const DEFAULT_FAL_IMAGE_MODEL = 'fal-ai/nano-banana';
export const FAL_IMAGE_EDIT_MODEL = 'fal-ai/nano-banana/edit';
export const OPENAI_IMAGE_MODEL = 'openai/gpt-image-2';
