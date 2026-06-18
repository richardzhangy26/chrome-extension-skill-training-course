import { m } from '@/locale/paraglide/messages';
import { createFileRoute } from '@tanstack/react-router';
import Container from '@/components/layout/container';
import { AiCaptionCard } from '@/components/ai/ai-caption-card';
import { AiCfImageCard } from '@/components/ai/ai-cf-image-card';
import { AiImageCard } from '@/components/ai/ai-image-card';
import { AiImageEditCard } from '@/components/ai/ai-image-edit-card';
import { AiSummarizationCard } from '@/components/ai/ai-summarization-card';
import { AiTaglineCard } from '@/components/ai/ai-tagline-card';
import { AiTranslationCard } from '@/components/ai/ai-translation-card';
import { AiTtsCard } from '@/components/ai/ai-tts-card';
import { websiteConfig } from '@/config/website';
import { seo } from '@/lib/seo';

export const Route = createFileRoute('/(pages)/ai')({
  head: () =>
    seo('/ai', {
      title: `${m.ai_page_title()} | ${websiteConfig.metadata?.name}`,
      description: m.ai_page_seo_description(),
    }),
  component: AiPage,
});

function AiPage() {
  return (
    <Container className="py-16 px-4">
      <div className="mx-auto max-w-5xl space-y-10 pb-16">
        <div className="space-y-4 text-center">
          <h1 className="text-3xl font-bold tracking-tight">
            {m.ai_page_title()}
          </h1>
          <p className="text-lg text-muted-foreground">
            {m.ai_page_description()}
          </p>
        </div>

        <section id="text-summarization" className="scroll-mt-20">
          <AiSummarizationCard />
        </section>
        <section id="translation" className="scroll-mt-20">
          <AiTranslationCard />
        </section>
        <section id="tagline-generator" className="scroll-mt-20">
          <AiTaglineCard />
        </section>
        <section id="text-to-speech" className="scroll-mt-20">
          <AiTtsCard />
        </section>
        <section id="image-captioning" className="scroll-mt-20">
          <AiCaptionCard />
        </section>
        <section id="image-generator-cloudflare" className="scroll-mt-20">
          <AiCfImageCard />
        </section>
        <section id="image-generator-fal" className="scroll-mt-20">
          <AiImageCard />
        </section>
        <section id="image-editing" className="scroll-mt-20">
          <AiImageEditCard />
        </section>
      </div>
    </Container>
  );
}
