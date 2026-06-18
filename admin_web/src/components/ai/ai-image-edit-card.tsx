import { m } from '@/locale/paraglide/messages';
import { useRef, useState } from 'react';
import {
  IconDownload,
  IconLoader2,
  IconPhotoEdit,
  IconUpload,
} from '@tabler/icons-react';
import { editAiImage } from '@/api/ai';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FAL_IMAGE_EDIT_MODEL } from '@/config/ai-models';
import { downloadFile } from '@/lib/download';
import { cn } from '@/lib/utils';
type PresetId = 'caricature' | 'pixar' | 'anime';
const MAX_BYTES = 1000000; // 1 MB upload cap
export function AiImageEditCard() {
  const promptPresets = [
    {
      id: 'caricature' as const,
      label: m.ai_page_image_edit_presets_0_label(),
      prompt: m.ai_page_image_edit_presets_0_prompt(),
    },
    {
      id: 'pixar' as const,
      label: m.ai_page_image_edit_presets_1_label(),
      prompt: m.ai_page_image_edit_presets_1_prompt(),
    },
    {
      id: 'anime' as const,
      label: m.ai_page_image_edit_presets_2_label(),
      prompt: m.ai_page_image_edit_presets_2_prompt(),
    },
  ];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | undefined>();
  const [imageBase64, setImageBase64] = useState<string | undefined>();
  const [imageMeta, setImageMeta] = useState<
    | {
        name: string;
        size: number;
      }
    | undefined
  >();
  const [activePreset, setActivePreset] = useState<PresetId | null>(
    promptPresets[0].id
  );
  const [prompt, setPrompt] = useState<string>(promptPresets[0].prompt);
  const [resultUrl, setResultUrl] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);
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
  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError(m.ai_page_common_upload_image_file());
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(
        `Image is too large (${(file.size / 1024).toFixed(0)} KB). ${m.ai_page_common_image_too_large()}`
      );
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      setImagePreview(dataUrl);
      setImageBase64(dataUrl);
      setImageMeta({ name: file.name, size: file.size });
      setResultUrl(undefined);
      setError(undefined);
    };
    reader.onerror = () => setError(m.ai_page_common_read_file_error());
    reader.readAsDataURL(file);
  }
  async function onTransform() {
    if (!imageBase64) return;
    setError(undefined);
    setResultUrl(undefined);
    setIsPending(true);
    try {
      const result = await editAiImage({
        data: { imageBase64, prompt },
      });
      setResultUrl(result.imageUrl);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : m.ai_page_image_edit_error()
      );
    } finally {
      setIsPending(false);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconPhotoEdit className="size-5 text-primary" />
          {m.ai_page_image_edit_title()}
        </CardTitle>
        <CardDescription>
          {m.ai_page_image_edit_description()}{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            {FAL_IMAGE_EDIT_MODEL}
          </code>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{m.ai_page_image_edit_image_label()}</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onFileChange}
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <IconUpload className="mr-1 size-4" />
                  {imageMeta
                    ? m.ai_page_common_change_image()
                    : m.ai_page_common_upload_image()}
                </Button>
                {imageMeta && (
                  <span className="text-xs text-muted-foreground">
                    {imageMeta.name} · {(imageMeta.size / 1024).toFixed(0)} KB
                  </span>
                )}
              </div>
              <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-md border bg-muted/30">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt={m.ai_page_image_edit_preview_alt()}
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="px-4 text-center text-sm text-muted-foreground">
                    {m.ai_page_image_edit_empty_image()}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-image-edit-prompt">
                {m.ai_page_image_edit_prompt_label()}
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
                id="ai-image-edit-prompt"
                rows={4}
                value={prompt}
                onChange={(event) => onPromptChange(event.target.value)}
                placeholder={m.ai_page_image_edit_placeholder()}
              />
              <Button
                type="button"
                onClick={onTransform}
                disabled={isPending || !imageBase64 || prompt.trim().length < 5}
              >
                {isPending ? (
                  <>
                    <IconLoader2 className="mr-1 size-4 animate-spin" />
                    {m.ai_page_image_edit_pending()}
                  </>
                ) : (
                  m.ai_page_image_edit_action()
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{m.ai_page_common_result()}</Label>
              {resultUrl && !isPending && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    downloadFile(resultUrl, `avatar-stylized-${Date.now()}.png`)
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
              ) : resultUrl ? (
                <img
                  src={resultUrl}
                  alt={m.ai_page_image_edit_result_alt()}
                  className="size-full object-cover"
                />
              ) : (
                <span className="px-4 text-center text-sm text-muted-foreground">
                  {m.ai_page_image_edit_empty()}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
