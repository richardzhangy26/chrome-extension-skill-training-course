import { m } from '@/locale/paraglide/messages';
import { useState } from 'react';
import { IconLoader2, IconWand } from '@tabler/icons-react';
import { summarizeText } from '@/api/ai';
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
import { Textarea } from '@/components/ui/textarea';
export function AiSummarizationCard() {
  const [input, setInput] = useState(m.ai_page_summarization_sample().trim());
  const [summary, setSummary] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);
  async function onGenerate() {
    setError(undefined);
    setSummary('');
    setIsPending(true);
    try {
      const result = await summarizeText({ data: { text: input } });
      setSummary(result.summary);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : m.ai_page_summarization_error()
      );
    } finally {
      setIsPending(false);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconWand className="size-5 text-primary" />
          {m.ai_page_summarization_title()}
        </CardTitle>
        <CardDescription>
          {m.ai_page_summarization_description()}{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            {WORKERS_AI_MODELS.summarization}
          </code>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ai-summarization-input">
              {m.ai_page_summarization_source_label()}
            </Label>
            <Textarea
              id="ai-summarization-input"
              rows={10}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={m.ai_page_summarization_placeholder()}
            />
            <p className="text-xs text-muted-foreground">
              {input.length} {m.ai_page_common_characters()}
            </p>
            <Button
              type="button"
              onClick={onGenerate}
              disabled={isPending || input.trim().length < 50}
            >
              {isPending ? (
                <>
                  <IconLoader2 className="mr-1 size-4 animate-spin" />
                  {m.ai_page_summarization_pending()}
                </>
              ) : (
                m.ai_page_summarization_action()
              )}
            </Button>
          </div>
          <div className="space-y-2">
            <Label>{m.ai_page_summarization_output_label()}</Label>
            <div className="min-h-[256px] rounded-md border bg-muted/30 p-4 text-sm leading-relaxed whitespace-pre-wrap">
              {error ? (
                <span className="text-destructive">{error}</span>
              ) : summary ? (
                summary
              ) : (
                <span className="text-muted-foreground">
                  {m.ai_page_summarization_empty()}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
