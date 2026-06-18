import { createFileRoute, notFound } from '@tanstack/react-router';
import Container from '@/components/layout/container';
import { MarkdownPage } from '@/components/page/markdown-page';
import { getPageBySlug } from '@/lib/pages';
import { websiteConfig } from '@/config/website';
import { seo } from '@/lib/seo';

export const Route = createFileRoute('/(legals)/privacy')({
  loader: () => {
    const page = getPageBySlug('privacy');
    if (!page) throw notFound();
    return { page };
  },
  head: ({ loaderData }) => {
    const p = loaderData?.page;
    if (!p) return {};
    return seo('/privacy', {
      title: `${p.title} | ${websiteConfig.metadata?.name}`,
      description: p.description,
    });
  },
  component: PrivacyPage,
});

function PrivacyPage() {
  const { page } = Route.useLoaderData();
  if (!page) throw notFound();
  return (
    <Container className="py-16 px-4">
      <MarkdownPage page={page} />
    </Container>
  );
}
