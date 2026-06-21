import { defineConfig } from 'vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import viteTsConfigPaths from 'vite-tsconfig-paths';
import { fileURLToPath, URL } from 'url';
import tailwindcss from '@tailwindcss/vite';
import { cloudflare } from '@cloudflare/vite-plugin';
import contentCollections from '@content-collections/vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';

const cloudflareWorkersClientStubId = '\0cloudflare-workers-client-stub';

const cloudflareWorkersClientStub = () => ({
  name: 'cloudflare-workers-client-stub',
  enforce: 'pre' as const,
  applyToEnvironment(environment: { name: string }) {
    return environment.name === 'client';
  },
  resolveId(source: string) {
    if (source === 'cloudflare:workers') {
      return cloudflareWorkersClientStubId;
    }
    return null;
  },
  load(id: string) {
    if (id !== cloudflareWorkersClientStubId) {
      return null;
    }
    return `
const createError = () =>
  new Error('cloudflare:workers is only available in the Cloudflare Worker server environment.');

const env = new Proxy(
  {},
  {
    get() {
      throw createError();
    },
  }
);

export { env };
`;
  },
});

/**
 * Vite configuration
 * https://vite.dev/config/
 */
const config = defineConfig({
  server: {
    allowedHosts: ['.trycloudflare.com', '.tanstarter.dev'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    cloudflareWorkersClientStub(),
    devtools({
      eventBusConfig: {
        port: 0,
      },
    }),
    tailwindcss(),
    contentCollections(),
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/locale/paraglide',
      strategy: ['url', 'cookie', 'baseLocale'],
      routeStrategies: [
        { match: '/api/:path(.*)?', exclude: true },
        { match: '/robots.txt', exclude: true },
        { match: '/sitemap.xml', exclude: true },
        { match: '/manifest.json', exclude: true },
      ],
      emitTsDeclarations: true,
      isServer: 'import.meta.env.SSR',
    }),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    // https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/
    cloudflare({
      viteEnvironment: {
        name: 'ssr',
      },
    }),
    // https://tanstack.dev/start/latest/docs/framework/react/build-from-scratch
    tanstackStart({
      srcDirectory: 'src',
      start: { entry: './start.tsx' },
      server: { entry: './server.ts' },
    }),
    // react's vite plugin must come after start's vite plugin
    viteReact(),
  ],
});

export default config;
