import { createFileRoute } from '@tanstack/react-router';
import { getBaseUrl } from '@/lib/urls';
import { baseLocale, locales, localizeHref } from '@/lib/locale';

const disallowedPaths = ['/auth', '/admin', '/settings', '/dashboard'];

function getDisallowRules() {
  return disallowedPaths
    .flatMap((path) => [
      path,
      ...locales
        .filter((locale) => locale !== baseLocale)
        .map((locale) => localizeHref(path, { locale })),
    ])
    .map((path) => `Disallow: ${path}`)
    .join('\n');
}

/**
 * Dynamic robots.txt
 * https://tanstack.dev/start/latest/docs/framework/react/guide/seo#dynamic-robotstxt
 */
export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: async () => {
        const base = getBaseUrl().replace(/\/$/, '');
        const robots = `User-agent: *
Allow: /
${getDisallowRules()}

Sitemap: ${base}/sitemap.xml`;

        return new Response(robots, {
          headers: {
            'Content-Type': 'text/plain',
          },
        });
      },
    },
  },
});
