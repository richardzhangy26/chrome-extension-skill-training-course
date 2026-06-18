import { createFileRoute } from '@tanstack/react-router';
import { websiteConfig } from '@/config/website';

/**
 * Dynamic Web App Manifest (PWA)
 * Serves /manifest.json with name/description from config instead of a static file
 * https://tanstack.dev/start/latest/docs/framework/react/guide/seo#dynamic-sitemap
 * https://web.dev/add-manifest/
 */
export const Route = createFileRoute('/manifest.json')({
  server: {
    handlers: {
      GET: async () => {
        const metadata = websiteConfig.metadata;
        const body = {
          name: metadata?.name,
          short_name: metadata?.name,
          description: metadata?.description,
          start_url: '/',
          scope: '/',
          display: 'standalone',
          // Keep in sync with <meta name="theme-color"> in src/routes/__root.tsx
          background_color: '#09090b',
          theme_color: '#09090b',
          icons: [
            { src: '/favicon.ico', sizes: '48x48', type: 'image/x-icon' },
            {
              src: '/android-chrome-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: '/android-chrome-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        };
        return new Response(JSON.stringify(body), {
          headers: {
            'Content-Type': 'application/manifest+json',
            'Cache-Control': 'public, max-age=3600',
          },
        });
      },
    },
  },
});
