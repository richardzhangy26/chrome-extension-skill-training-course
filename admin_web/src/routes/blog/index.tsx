import { m } from '@/locale/paraglide/messages';
import { createFileRoute, notFound } from '@tanstack/react-router';
import Container from '@/components/layout/container';
import { BlogGrid } from '@/components/blog/blog-grid';
import { BlogPagination } from '@/components/blog/blog-pagination';
import { getPaginatedPosts } from '@/lib/blog';
import { websiteConfig } from '@/config/website';
import { seo } from '@/lib/seo';
import { getCanonicalUrlForLocale } from '@/lib/urls';
import { getLocale, localeConfig } from '@/lib/locale';

export const Route = createFileRoute('/blog/')({
  validateSearch: (search: Record<string, unknown>) => ({
    page:
      typeof search.page === 'number'
        ? search.page
        : typeof search.page === 'string'
          ? Number(search.page) || undefined
          : undefined,
  }),
  loader: ({ location }) => {
    const page = Number(new URLSearchParams(location.search).get('page')) || 1;
    return getPaginatedPosts(page);
  },
  head: ({ loaderData }) => {
    const path = '/blog';
    const currentPage = loaderData?.currentPage ?? 1;
    const totalPages = loaderData?.totalPages ?? 1;
    const pageSuffix = currentPage > 1 ? ` - Page ${currentPage}` : '';
    const metadata = seo(path, {
      title: `${m.blog_title()}${pageSuffix} | ${websiteConfig.metadata?.name}`,
      description: m.blog_description(),
    });
    // Pass the current locale explicitly so canonical/prev/next are stable
    // across SSR + CSR regardless of any mid-render locale swap.
    const localizedUrl = (page?: number) => {
      const base = getCanonicalUrlForLocale(path, getLocale());
      return page && page > 1 ? `${base}?page=${page}` : base;
    };
    const canonicalHref = localizedUrl(currentPage);
    const paginationLinks: Array<{
      rel: string;
      href: string;
    }> = [{ rel: 'canonical', href: canonicalHref }];
    if (currentPage > 1) {
      paginationLinks.push({
        rel: 'prev',
        href: localizedUrl(currentPage - 1),
      });
    }
    if (currentPage < totalPages) {
      paginationLinks.push({
        rel: 'next',
        href: localizedUrl(currentPage + 1),
      });
    }
    const blogJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: m.blog_title(),
      description: m.blog_description(),
      url: canonicalHref,
      inLanguage: localeConfig[getLocale()].hreflang,
    };
    return {
      ...metadata,
      links: [
        ...paginationLinks,
        ...metadata.links.filter((link) => link.rel !== 'canonical'),
      ],
      scripts: [
        {
          type: 'application/ld+json',
          children: JSON.stringify(blogJsonLd),
        },
      ],
    };
  },
  component: BlogListPage,
});

function BlogListPage() {
  const { posts, totalPages, currentPage } = Route.useLoaderData();
  if (!websiteConfig.blog?.enable) {
    throw notFound();
  }
  return (
    <Container className="py-16 px-4">
      <div className="mx-auto space-y-8">
        <div className="space-y-4 text-center">
          <h1 className="text-3xl font-bold tracking-tight">
            {m.blog_title()}
          </h1>
          <p className="text-muted-foreground text-lg">
            {m.blog_description()}
          </p>
        </div>
        <BlogGrid posts={posts} />
        <BlogPagination currentPage={currentPage} totalPages={totalPages} />
      </div>
    </Container>
  );
}
