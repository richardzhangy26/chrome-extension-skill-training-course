import { m } from '@/locale/paraglide/messages';
import { useState } from 'react';
import { IconLoader2, IconSparkles } from '@tabler/icons-react';
import { generateTaglines } from '@/api/ai';
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
export function AiTaglineCard() {
  const [product, setProduct] = useState(m.ai_page_tagline_sample());
  const [taglines, setTaglines] = useState<string[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);
  async function onGenerate() {
    setError(undefined);
    setTaglines([]);
    setIsPending(true);
    try {
      const result = await generateTaglines({ data: { product } });
      setTaglines(result.taglines);
    } catch (err) {
      setError(err instanceof Error ? err.message : m.ai_page_tagline_error());
    } finally {
      setIsPending(false);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconSparkles className="size-5 text-primary" />
          {m.ai_page_tagline_title()}
        </CardTitle>
        <CardDescription>
          {m.ai_page_tagline_description()}{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            {WORKERS_AI_MODELS.tagline}
          </code>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ai-tagline-input">
              {m.ai_page_tagline_input_label()}
            </Label>
            <Textarea
              id="ai-tagline-input"
              rows={8}
              value={product}
              onChange={(event) => setProduct(event.target.value)}
              placeholder={m.ai_page_tagline_placeholder()}
            />
            <p className="text-xs text-muted-foreground">
              {product.length} {m.ai_page_common_characters()}
            </p>
            <Button
              type="button"
              onClick={onGenerate}
              disabled={isPending || product.trim().length < 10}
            >
              {isPending ? (
                <>
                  <IconLoader2 className="mr-1 size-4 animate-spin" />
                  {m.ai_page_tagline_pending()}
                </>
              ) : (
                m.ai_page_tagline_action()
              )}
            </Button>
          </div>
          <div className="space-y-2">
            <Label>{m.ai_page_tagline_output_label()}</Label>
            <div className="min-h-[208px] rounded-md border bg-muted/30 p-4 text-sm leading-relaxed">
              {error ? (
                <span className="text-destructive">{error}</span>
              ) : taglines.length > 0 ? (
                <ol className="list-decimal space-y-2 pl-5">
                  {taglines.map((tagline) => (
                    <li key={tagline}>{tagline}</li>
                  ))}
                </ol>
              ) : (
                <span className="text-muted-foreground">
                  {m.ai_page_tagline_empty()}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
