import { m } from '@/locale/paraglide/messages';
import { ReleaseCard } from '@/components/changelog/release-card';
import Container from '@/components/layout/container';
import { websiteConfig } from '@/config/website';
import { getChangelogReleases } from '@/lib/changelog';
import { seo } from '@/lib/seo';
import { createFileRoute, notFound } from '@tanstack/react-router';

export const Route = createFileRoute('/(pages)/changelog')({
  loader: () => {
    const releases = getChangelogReleases();
    if (!releases?.length) throw notFound();
    return releases;
  },
  head: () =>
    seo('/changelog', {
      title: `${m.changelog_title()} | ${websiteConfig.metadata?.name}`,
      description: m.changelog_description(),
    }),
  component: ChangelogPage,
});

function ChangelogPage() {
  const releases = Route.useLoaderData();
  return (
    <Container className="py-16 px-4">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="space-y-4">
          <h1 className="text-center text-3xl font-bold tracking-tight">
            {m.changelog_title()}
          </h1>
          <p className="text-center text-lg text-muted-foreground">
            {m.changelog_subtitle()}
          </p>
        </div>

        <div className="mt-8">
          {releases?.map((release) => (
            <ReleaseCard key={release.slug} release={release} />
          ))}
        </div>
      </div>
    </Container>
  );
}
