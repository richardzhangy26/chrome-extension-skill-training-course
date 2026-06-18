import { m } from '@/locale/paraglide/messages';
import { useState } from 'react';
import {
  IconArrowsExchange,
  IconLanguage,
  IconLoader2,
} from '@tabler/icons-react';
import { translateText } from '@/api/ai';
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
type Language =
  | 'english'
  | 'chinese'
  | 'french'
  | 'german'
  | 'spanish'
  | 'japanese'
  | 'korean'
  | 'russian'
  | 'portuguese'
  | 'arabic';
const LANGUAGES: {
  value: Language;
  label: string;
}[] = [
  { value: 'english', label: 'English' },
  { value: 'chinese', label: '中文 Chinese' },
  { value: 'french', label: 'Français French' },
  { value: 'german', label: 'Deutsch German' },
  { value: 'spanish', label: 'Español Spanish' },
  { value: 'japanese', label: '日本語 Japanese' },
  { value: 'korean', label: '한국어 Korean' },
  { value: 'russian', label: 'Русский Russian' },
  { value: 'portuguese', label: 'Português Portuguese' },
  { value: 'arabic', label: 'العربية Arabic' },
];
export function AiTranslationCard() {
  const [input, setInput] = useState(m.ai_page_translation_sample());
  const [sourceLang, setSourceLang] = useState<Language>('english');
  const [targetLang, setTargetLang] = useState<Language>('chinese');
  const [translation, setTranslation] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);
  function onSwap() {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setInput(translation || input);
    setTranslation('');
  }
  async function onTranslate() {
    setError(undefined);
    setTranslation('');
    setIsPending(true);
    try {
      const result = await translateText({
        data: { text: input, sourceLang, targetLang },
      });
      setTranslation(result.translatedText);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : m.ai_page_translation_error()
      );
    } finally {
      setIsPending(false);
    }
  }
  const sameLang = sourceLang === targetLang;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconLanguage className="size-5 text-primary" />
          {m.ai_page_translation_title()}
        </CardTitle>
        <CardDescription>
          {m.ai_page_translation_description()}{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            {WORKERS_AI_MODELS.translation}
          </code>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {m.ai_page_translation_from()}
            </Label>
            <Select
              items={LANGUAGES}
              value={sourceLang}
              onValueChange={(value) => {
                if (value) setSourceLang(value as Language);
              }}
            >
              <SelectTrigger className="w-44" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem
                    key={lang.value}
                    value={lang.value}
                    label={lang.label}
                  >
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="mb-0.5 shrink-0"
            onClick={onSwap}
            aria-label={m.ai_page_translation_swap()}
          >
            <IconArrowsExchange className="size-4" />
          </Button>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {m.ai_page_translation_to()}
            </Label>
            <Select
              items={LANGUAGES}
              value={targetLang}
              onValueChange={(value) => {
                if (value) setTargetLang(value as Language);
              }}
            >
              <SelectTrigger className="w-44" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem
                    key={lang.value}
                    value={lang.value}
                    label={lang.label}
                  >
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ai-translation-input">
              {m.ai_page_translation_source_label()}
            </Label>
            <Textarea
              id="ai-translation-input"
              rows={6}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={m.ai_page_translation_placeholder()}
            />
            <p className="text-xs text-muted-foreground">
              {input.length} {m.ai_page_common_characters()}
            </p>
            <Button
              type="button"
              onClick={onTranslate}
              disabled={isPending || sameLang || input.trim().length === 0}
            >
              {isPending ? (
                <>
                  <IconLoader2 className="mr-1 size-4 animate-spin" />
                  {m.ai_page_translation_pending()}
                </>
              ) : (
                m.ai_page_translation_action()
              )}
            </Button>
            {sameLang && (
              <p className="text-xs text-destructive">
                {m.ai_page_translation_same_language()}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>{m.ai_page_translation_output_label()}</Label>
            <div className="min-h-[160px] rounded-md border bg-muted/30 p-4 text-sm leading-relaxed whitespace-pre-wrap">
              {error ? (
                <span className="text-destructive">{error}</span>
              ) : translation ? (
                translation
              ) : (
                <span className="text-muted-foreground">
                  {m.ai_page_translation_empty()}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
