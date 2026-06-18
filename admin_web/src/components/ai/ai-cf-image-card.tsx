import { m } from '@/locale/paraglide/messages';
import { useState } from 'react';
import { IconDownload, IconLoader2, IconSparkles } from '@tabler/icons-react';
import { generateCfImage } from '@/api/ai';
import { Button } from '@/components/ui/button';
import { CF_IMAGE_MODELS, DEFAULT_CF_IMAGE_MODEL } from '@/config/ai-models';
import { downloadFile } from '@/lib/download';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
type CfImageModel = (typeof CF_IMAGE_MODELS)[number];
const CF_MODELS: {
  value: CfImageModel;
  label: string;
  hint: string;
  beta?: boolean;
}[] = [
  {
    value: CF_IMAGE_MODELS[0],
    label: 'Flux.1 Schnell',
    hint: 'Default · 12B distilled flow transformer',
  },
  {
    value: CF_IMAGE_MODELS[1],
    label: 'SDXL Lightning',
    hint: 'Lightning-fast 1024px generations',
    beta: true,
  },
  {
    value: CF_IMAGE_MODELS[2],
    label: 'DreamShaper 8 LCM',
    hint: 'Photorealistic Stable Diffusion fine-tune',
  },
];
const CF_MODEL_SELECT_ITEMS = CF_MODELS.map((model) => ({
  ...model,
  label: model.beta ? `${model.label} (Beta)` : model.label,
}));
type PresetId =
  | 'astronaut-panda'
  | 'cyberpunk-tokyo'
  | 'watercolor-village'
  | 'product-earbuds'
  | 'pixel-dragon';
export function AiCfImageCard() {
  const promptPresets = [
    {
      id: 'astronaut-panda' as const,
      label: m.ai_page_image_presets_0_label(),
      prompt: m.ai_page_image_presets_0_prompt(),
    },
    {
      id: 'cyberpunk-tokyo' as const,
      label: m.ai_page_image_presets_1_label(),
      prompt: m.ai_page_image_presets_1_prompt(),
    },
    {
      id: 'watercolor-village' as const,
      label: m.ai_page_image_presets_2_label(),
      prompt: m.ai_page_image_presets_2_prompt(),
    },
    {
      id: 'product-earbuds' as const,
      label: m.ai_page_image_presets_3_label(),
      prompt: m.ai_page_image_presets_3_prompt(),
    },
    {
      id: 'pixel-dragon' as const,
      label: m.ai_page_image_presets_4_label(),
      prompt: m.ai_page_image_presets_4_prompt(),
    },
  ];
  const [activePreset, setActivePreset] = useState<PresetId | null>(
    promptPresets[0].id
  );
  const [prompt, setPrompt] = useState<string>(promptPresets[0].prompt);
  const [model, setModel] = useState<CfImageModel>(DEFAULT_CF_IMAGE_MODEL);
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);
  const activeModel = CF_MODELS.find((m) => m.value === model);
  function onSelectPreset(id: PresetId) {
    const preset = promptPresets.find((p) => p.id === id);
    if (!preset) return;
    setActivePreset(id);
    setPrompt(preset.prompt);
  }
  function onPromptChange(value: string) {
    setPrompt(value);
    const match = promptPresets.find((p) => p.prompt === value);
    setActivePreset(match?.id ?? null);
  }
  async function onGenerate() {
    setError(undefined);
    setImageUrl(undefined);
    setIsPending(true);
    try {
      const result = await generateCfImage({ data: { prompt, model } });
      setImageUrl(result.imageUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : m.ai_page_image_error());
    } finally {
      setIsPending(false);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconSparkles className="size-5 text-primary" />
          {m.ai_page_image_title_cf()}
        </CardTitle>
        <CardDescription>
          {m.ai_page_image_description_cf()}{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            {model}
          </code>{' '}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            {m.ai_page_common_model()}
          </Label>
          <Select
            items={CF_MODEL_SELECT_ITEMS}
            value={model}
            onValueChange={(value) => {
              if (value) setModel(value as CfImageModel);
            }}
          >
            <SelectTrigger className="w-72" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CF_MODEL_SELECT_ITEMS.map((m) => (
                <SelectItem key={m.value} value={m.value} label={m.label}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {activeModel && (
            <p className="text-xs text-muted-foreground">{activeModel.hint}</p>
          )}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ai-cf-image-prompt">
              {m.ai_page_common_prompt()}
            </Label>
            <div className="flex flex-wrap gap-2">
              {promptPresets.map((preset) => {
                const isActive = activePreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onSelectPreset(preset.id)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs transition-colors',
                      isActive
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
                    )}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
            <Textarea
              id="ai-cf-image-prompt"
              rows={6}
              value={prompt}
              onChange={(event) => onPromptChange(event.target.value)}
              placeholder={m.ai_page_image_placeholder()}
            />
            <p className="text-xs text-muted-foreground">
              {prompt.length} {m.ai_page_common_characters()}
              {activePreset === null &&
                ` · ${m.ai_page_common_custom_prompt()}`}
            </p>
            <Button
              type="button"
              onClick={onGenerate}
              disabled={isPending || prompt.trim().length < 3}
            >
              {isPending ? (
                <>
                  <IconLoader2 className="mr-1 size-4 animate-spin" />
                  {m.ai_page_image_pending()}
                </>
              ) : (
                m.ai_page_image_action()
              )}
            </Button>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{m.ai_page_common_result()}</Label>
              {imageUrl && !isPending && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    downloadFile(
                      imageUrl,
                      `cf-${model.replace(/[@/]/g, '-')}-${Date.now()}.jpg`
                    )
                  }
                >
                  <IconDownload className="mr-1 size-4" />
                  {m.ai_page_common_download()}
                </Button>
              )}
            </div>
            <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-md border bg-muted/30">
              {error ? (
                <span className="px-4 text-center text-sm text-destructive">
                  {error}
                </span>
              ) : isPending ? (
                <IconLoader2 className="size-8 animate-spin text-muted-foreground" />
              ) : imageUrl ? (
                <img
                  src={imageUrl}
                  alt={m.ai_page_common_generated_image_alt()}
                  className="size-full object-cover"
                />
              ) : (
                <span className="px-4 text-center text-sm text-muted-foreground">
                  {m.ai_page_image_empty()}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
