import { parseWranglerConfig } from './parse-wrangler';

try {
  const config = parseWranglerConfig();
  const dbName = config.d1_databases?.[0]?.database_name;

  if (!dbName) {
    console.error('Database name not found in wrangler.jsonc');
    process.exit(1);
  }

  console.log(dbName);
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(errorMessage);
  process.exit(1);
}
