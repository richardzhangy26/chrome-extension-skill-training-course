import { m } from '@/locale/paraglide/messages';
import { useState } from 'react';
import { IconLoader2, IconMicrophone } from '@tabler/icons-react';
import { synthesizeSpeech } from '@/api/ai';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { WORKERS_AI_MODELS } from '@/config/ai-models';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
type Speaker =
  | 'angus'
  | 'asteria'
  | 'arcas'
  | 'orion'
  | 'orpheus'
  | 'athena'
  | 'luna'
  | 'zeus'
  | 'perseus'
  | 'helios'
  | 'hera'
  | 'stella';
const SPEAKERS: {
  value: Speaker;
  label: string;
}[] = [
  { value: 'asteria', label: 'Asteria · Female (US)' },
  { value: 'luna', label: 'Luna · Female (US)' },
  { value: 'stella', label: 'Stella · Female (US)' },
  { value: 'athena', label: 'Athena · Female (UK)' },
  { value: 'hera', label: 'Hera · Female (US)' },
  { value: 'angus', label: 'Angus · Male (IE)' },
  { value: 'arcas', label: 'Arcas · Male (US)' },
  { value: 'orion', label: 'Orion · Male (US)' },
  { value: 'orpheus', label: 'Orpheus · Male (US)' },
  { value: 'perseus', label: 'Perseus · Male (US)' },
  { value: 'helios', label: 'Helios · Male (UK)' },
  { value: 'zeus', label: 'Zeus · Male (US)' },
];
export function AiTtsCard() {
  const [text, setText] = useState(m.ai_page_tts_sample());
  const [speaker, setSpeaker] = useState<Speaker>('asteria');
  const [audioUrl, setAudioUrl] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);
  async function onGenerate() {
    setError(undefined);
    setAudioUrl(undefined);
    setIsPending(true);
    try {
      const result = await synthesizeSpeech({ data: { text, speaker } });
      setAudioUrl(result.audioUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : m.ai_page_tts_error());
    } finally {
      setIsPending(false);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconMicrophone className="size-5 text-primary" />
          {m.ai_page_tts_title()}
        </CardTitle>
        <CardDescription>
          {m.ai_page_tts_description()}{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            {WORKERS_AI_MODELS.textToSpeech}
          </code>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {m.ai_page_tts_voice()}
            </Label>
            <Select
              items={SPEAKERS}
              value={speaker}
              onValueChange={(value) => {
                if (value) setSpeaker(value as Speaker);
              }}
            >
              <SelectTrigger className="w-56" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPEAKERS.map((s) => (
                  <SelectItem key={s.value} value={s.value} label={s.label}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ai-tts-input">{m.ai_page_tts_input_label()}</Label>
            <Textarea
              id="ai-tts-input"
              rows={6}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={m.ai_page_tts_placeholder()}
            />
            <p className="text-xs text-muted-foreground">
              {text.length} characters · ~$
              {((text.length / 1000) * 0.015).toFixed(4)}{' '}
              {m.ai_page_tts_cost_suffix()}
            </p>
            <Button
              type="button"
              onClick={onGenerate}
              disabled={isPending || text.trim().length === 0}
            >
              {isPending ? (
                <>
                  <IconLoader2 className="mr-1 size-4 animate-spin" />
                  {m.ai_page_tts_pending()}
                </>
              ) : (
                m.ai_page_tts_action()
              )}
            </Button>
          </div>
          <div className="space-y-2">
            <Label>{m.ai_page_tts_output_label()}</Label>
            <div className="flex min-h-[160px] w-full items-center justify-center rounded-md border bg-muted/30 p-4">
              {error ? (
                <span className="text-center text-sm text-destructive">
                  {error}
                </span>
              ) : isPending ? (
                <IconLoader2 className="size-8 animate-spin text-muted-foreground" />
              ) : audioUrl ? (
                <audio controls src={audioUrl} className="w-full">
                  <track kind="captions" />
                </audio>
              ) : (
                <span className="text-center text-sm text-muted-foreground">
                  {m.ai_page_tts_empty()}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
