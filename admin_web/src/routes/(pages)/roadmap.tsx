import { m } from '@/locale/paraglide/messages';
import { createFileRoute } from '@tanstack/react-router';
import Container from '@/components/layout/container';
import { Roadmap } from '@/components/roadmap/roadmap';
import { websiteConfig } from '@/config/website';
import { seo } from '@/lib/seo';

export const Route = createFileRoute('/(pages)/roadmap')({
  head: () =>
    seo('/roadmap', {
      title: `${m.roadmap_title()} | ${websiteConfig.metadata?.name}`,
      description: m.roadmap_description(),
    }),
  component: RoadmapPage,
});

/**
 * Roadmap page with kanban board. Inspired by https://nsui.irung.me/roadmap
 */
function RoadmapPage() {
  return (
    <Container className="py-16 px-4">
      <div className="mx-auto space-y-8">
        <div className="space-y-4">
          <h1 className="text-center text-3xl font-bold tracking-tight">
            {m.roadmap_title()}
          </h1>
          <p className="text-center text-lg text-muted-foreground">
            {m.roadmap_subtitle()}
          </p>
        </div>

        <Roadmap />
      </div>
    </Container>
  );
}
