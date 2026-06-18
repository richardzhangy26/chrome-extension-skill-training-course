import { m } from '@/locale/paraglide/messages';
import { createFileRoute } from '@tanstack/react-router';
import Container from '@/components/layout/container';
import { WaitlistFormCard } from '@/components/waitlist/waitlist-form-card';
import { websiteConfig } from '@/config/website';
import { seo } from '@/lib/seo';

export const Route = createFileRoute('/(pages)/waitlist')({
  head: () =>
    seo('/waitlist', {
      title: `${m.waitlist_title()} | ${websiteConfig.metadata?.name}`,
      description: m.waitlist_description(),
    }),
  component: WaitlistPage,
});

function WaitlistPage() {
  return (
    <Container className="py-16 px-4">
      <div className="mx-auto max-w-4xl space-y-8 pb-16">
        <div className="space-y-4">
          <h1 className="text-center text-3xl font-bold tracking-tight">
            {m.waitlist_title()}
          </h1>
          <p className="text-center text-lg text-muted-foreground">
            {m.waitlist_description()}
          </p>
        </div>
        <WaitlistFormCard />
      </div>
    </Container>
  );
}
