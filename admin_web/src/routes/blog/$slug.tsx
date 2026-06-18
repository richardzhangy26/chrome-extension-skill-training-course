import { m } from '@/locale/paraglide/messages';
import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import Container from '@/components/layout/container';
import { Markdown } from '@/components/markdown/markdown';
import { getPostBySlug } from '@/lib/blog';
import { websiteConfig } from '@/config/website';
import { getCanonicalUrl, getImageUrl } from '@/lib/urls';
import { getLocale, localeConfig } from '@/lib/locale';
import { seo } from '@/lib/seo';
import { IconArrowLeft } from '@tabler/icons-react';
import { formatDate } from '@/lib/formatter';

export const Route = createFileRoute('/blog/$slug')({
  loader: async ({ params }) => {
    const post = getPostBySlug(params.slug);
    if (!post) throw notFound();
    return post;
  },
  head: ({ loaderData, params }) => {
    const post = loaderData;
    if (!post) return {};
    const path = `/blog/${params.slug}`;
    const title = `${post.title} | ${websiteConfig.metadata?.name}`;
    const description =
      post.description ?? websiteConfig.metadata?.description ?? '';
    const image = post.image ? getImageUrl(post.image) : undefined;
    const canonicalUrl = getCanonicalUrl(path);
    const metadata = seo(path, {
      title,
      description,
      image,
      type: 'article',
    });
    const articleJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      description,
      inLanguage: localeConfig[getLocale()].hreflang,
      ...(image && { image }),
      datePublished: new Date(post.date).toISOString(),
      dateModified: new Date(post.date).toISOString(),
      url: canonicalUrl,
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': canonicalUrl,
      },
      author: {
        '@type': 'Organization',
        name: websiteConfig.metadata?.name ?? '',
      },
      publisher: {
        '@type': 'Organization',
        name: websiteConfig.metadata?.name ?? '',
        logo: {
          '@type': 'ImageObject',
          url: getImageUrl(
            websiteConfig.metadata?.images?.logoLight ?? '/logo.png'
          ),
        },
      },
    };
    return {
      ...metadata,
      scripts: [
        {
          type: 'application/ld+json',
          children: JSON.stringify(articleJsonLd),
        },
      ],
    };
  },
  component: BlogPostPage,
});

function BlogPostPage() {
  const post = Route.useLoaderData();
  if (!post || !websiteConfig.blog?.enable) throw notFound();
  return (
    <Container className="py-16 px-4">
      <div className="mx-auto max-w-4xl">
        <Link
          to="/blog"
          search={{ page: 1 }}
          className="mb-6 inline-flex items-center gap-2 text-muted-foreground text-sm hover:text-foreground"
        >
          <IconArrowLeft className="size-4" />
          {m.blog_all_posts()}
        </Link>

        <article>
          <div className="mb-4 flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
            <span className="rounded-full bg-muted px-2.5 py-0.5 font-medium capitalize">
              {post.category}
            </span>
            <span>{formatDate(new Date(post.date))}</span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight">{post.title}</h1>

          {post.description && (
            <p className="mt-4 text-muted-foreground text-lg leading-relaxed">
              {post.description}
            </p>
          )}

          <div className="mt-6 pt-10 border-t border-border">
            <Markdown
              content={post.content}
              className="prose prose-neutral dark:prose-invert max-w-none"
            />
          </div>

          <div className="mt-10 pt-6 border-t border-border">
            <Link
              to="/blog"
              search={{ page: 1 }}
              className="inline-flex items-center gap-2 text-muted-foreground text-sm hover:text-foreground"
            >
              <IconArrowLeft className="size-4" />
              {m.blog_all_posts()}
            </Link>
          </div>
        </article>
      </div>
    </Container>
  );
}
