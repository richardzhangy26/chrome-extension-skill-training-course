import type { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
  useRouterState,
} from '@tanstack/react-router';
import { Analytics } from '@/components/analytics/analytics';
import { CrispChat } from '@/components/chatbox/crisp-chat';
import { ThemeProvider } from '@/components/theme/theme-provider';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { DefaultNotFound } from '@/components/layout/default-not-found';
import { Toaster } from '@/components/shared/toaster';
import { websiteConfig } from '@/config/website';
import appCss from '../styles.css?url';
import { DefaultCatchBoundary } from '@/components/layout/default-catch-boundary';
import { Routes } from '@/lib/routes';
import { getCanonicalUrl, getOgImage, twitterHandleFromUrl } from '@/lib/urls';
import {
  getCanonicalPathname,
  getLocale,
  localeConfig,
  locales,
} from '@/lib/locale';
import { TooltipProvider } from '@/components/ui/tooltip';
import { lazy } from 'react';

const DevTools = import.meta.env.DEV
  ? lazy(() => import('@/integrations/devtools'))
  : () => null;

/**
 * https://github.com/backpine/tanstack-start-on-cloudflare/blob/main/src/routes/__root.tsx
 */
export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => {
    const ogImage = getOgImage();
    const twitterSite = websiteConfig.social?.twitter
      ? twitterHandleFromUrl(websiteConfig.social.twitter)
      : null;
    const currentLocale = getLocale();
    // OG locale format uses underscore (e.g. en_US, zh_CN), unlike BCP 47 used
    // for <html lang> / hreflang which uses hyphens.
    const ogLocale = localeConfig[currentLocale].hreflang.replace('-', '_');
    const alternateOgLocales = locales
      .filter((l) => l !== currentLocale)
      .map((l) => localeConfig[l].hreflang.replace('-', '_'));
    return {
      meta: [
        { charSet: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { title: websiteConfig.metadata?.title },
        { name: 'description', content: websiteConfig.metadata?.description },
        { name: 'theme-color', content: '#09090b' },
        // Default OG / Twitter / canonical — pages with their own head()
        // override these with page-specific values. These ensure 404 / error
        // pages and any future route that forgets to call seo() still get
        // shareable social metadata.
        { property: 'og:type', content: 'website' },
        {
          property: 'og:site_name',
          content: websiteConfig.metadata?.name ?? '',
        },
        { property: 'og:locale', content: ogLocale },
        ...alternateOgLocales.map((loc) => ({
          property: 'og:locale:alternate',
          content: loc,
        })),
        { property: 'og:title', content: websiteConfig.metadata?.title ?? '' },
        {
          property: 'og:description',
          content: websiteConfig.metadata?.description ?? '',
        },
        { property: 'og:url', content: getCanonicalUrl('/') },
        ...(ogImage ? [{ property: 'og:image', content: ogImage }] : []),
        { name: 'twitter:title', content: websiteConfig.metadata?.title ?? '' },
        ...(twitterSite
          ? [{ name: 'twitter:site', content: twitterSite }]
          : []),
        {
          name: 'twitter:description',
          content: websiteConfig.metadata?.description ?? '',
        },
        ...(ogImage
          ? [
              { name: 'twitter:card', content: 'summary_large_image' as const },
              { name: 'twitter:image', content: ogImage },
            ]
          : []),
      ],
      links: [
        { rel: 'stylesheet', href: appCss },
        {
          rel: 'apple-touch-icon',
          sizes: '180x180',
          href: '/apple-touch-icon.png',
        },
        {
          rel: 'icon',
          type: 'image/png',
          sizes: '32x32',
          href: '/favicon-32x32.png',
        },
        {
          rel: 'icon',
          type: 'image/png',
          sizes: '16x16',
          href: '/favicon-16x16.png',
        },
        { rel: 'icon', href: '/favicon.ico' },
        { rel: 'manifest', href: '/manifest.json' },
      ],
    };
  },
  // shellComponent automatically wraps root component, errorComponent, and notFoundComponent
  shellComponent: RootDocument,
  component: RootComponent,
  notFoundComponent: DefaultNotFound,
  errorComponent: DefaultCatchBoundary,
});

/**
 * Root component (wrapped by shellComponent: RootDocument)
 * Only marketing pages get Navbar + Footer; auth/dashboard/404 pages don't.
 */
function RootComponent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname }) ?? '';
  const canonicalPathname = getCanonicalPathname(pathname);
  const matches = useRouterState({ select: (s) => s.matches }) ?? [];
  const isAuthPages = canonicalPathname.startsWith(Routes.Auth);
  const isProtectedPages =
    canonicalPathname.startsWith(Routes.Admin) ||
    canonicalPathname.startsWith(Routes.Dashboard) ||
    canonicalPathname.startsWith(Routes.Settings);
  // When no child route matches (e.g. /hello), only root is in matches; use minimal layout
  const isNotFound =
    canonicalPathname !== Routes.Root &&
    canonicalPathname !== '' &&
    matches.length <= 1;

  if (isAuthPages || isProtectedPages || isNotFound) {
    return (
      <div className="flex min-h-screen flex-col">
        <main id="main-content" className="flex-1">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar scroll />
      <main id="main-content" className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

/**
 * Root document
 */
function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang={localeConfig[getLocale()].hreflang} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider>
          <TooltipProvider>
            {children}
            <Toaster richColors position="top-right" offset={64} />
          </TooltipProvider>
        </ThemeProvider>
        <DevTools />
        <Analytics />
        <CrispChat />
        <Scripts />
      </body>
    </html>
  );
}
