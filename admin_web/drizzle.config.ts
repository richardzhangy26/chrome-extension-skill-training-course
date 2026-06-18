import { defineConfig } from 'drizzle-kit';

/**
 * 1. Drizzle Kit configuration for Cloudflare D1 (SQLite)
 * https://orm.drizzle.team/docs/connect-cloudflare-d1
 *
 * 2. Drizzle | Cloudflare D1 HTTP API with Drizzle Kit
 * https://orm.drizzle.team/docs/guides/d1-http-with-drizzle-kit
 */
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  driver: 'd1-http',
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
    token: process.env.CLOUDFLARE_API_TOKEN!,
  },
});
