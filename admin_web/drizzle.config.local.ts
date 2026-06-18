import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'drizzle-kit';
import { pathToFileURL } from 'node:url';

/**
 * Drizzle Kit config for LOCAL D1 database (used by drizzle-kit studio).
 * Automatically finds the local SQLite file created by wrangler dev.
 */
function getLocalD1DB() {
  try {
    const basePath = path.resolve(
      '.wrangler/state/v3/d1/miniflare-D1DatabaseObject'
    );
    const dbFile = fs
      .readdirSync(basePath, { encoding: 'utf-8' })
      .find(
        (f) => f.endsWith('.sqlite') && !path.basename(f).startsWith('metadata')
      );

    if (!dbFile) {
      return undefined;
    }

    return pathToFileURL(path.resolve(basePath, dbFile)).href;
  } catch (error) {
    console.error('Error reading local D1 database file:', error);
    return undefined;
  }
}

/**
 * Drizzle Kit configuration for Cloudflare D1 (SQLite)
 * https://orm.drizzle.team/docs/connect-cloudflare-d1
 */
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: getLocalD1DB() || 'file:./dev.db',
  },
});
