import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseEnvFile(filePath: string): Record<string, string> {
  const content = fs.readFileSync(filePath, 'utf8');
  const env: Record<string, string> = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    const value = rawValue.replace(/^['"]|['"]$/g, '');
    env[key] = value;
  }

  return env;
}

// ---------------------------------------------------------------------------
// Sync deploy.yml env block with .env.example
// ---------------------------------------------------------------------------

const DEPLOY_YML = path.join(
  __dirname,
  '..',
  '.github',
  'workflows',
  'deploy.yml'
);

/** Prefixes of env vars that must appear in the Build step's env block */
const BUILD_PREFIXES = ['VITE_', 'CLOUDFLARE_'];

function syncDeployYml(): void {
  const envPath = path.join(__dirname, '..', '.env.production');
  if (!fs.existsSync(envPath)) {
    console.log('⚠️  .env.production not found, skipping deploy.yml sync\n');
    return;
  }
  if (!fs.existsSync(DEPLOY_YML)) {
    console.log('⚠️  deploy.yml not found, skipping deploy.yml sync\n');
    return;
  }

  // Collect build-time var names from .env.production
  const envVars = parseEnvFile(envPath);
  const requiredKeys = Object.keys(envVars).filter((k) =>
    BUILD_PREFIXES.some((p) => k.startsWith(p))
  );

  // Parse deploy.yml and find the job-level env block (under `deploy:`)
  const ymlContent = fs.readFileSync(DEPLOY_YML, 'utf8');
  const lines = ymlContent.split('\n');

  // Find the job-level `env:` — sits directly under a job key (e.g. `deploy:`)
  // with indentation level 4 (4 spaces: `    env:`)
  let envLineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^ {4}env:\s*$/.test(lines[i])) {
      envLineIndex = i;
      break;
    }
  }

  if (envLineIndex === -1) {
    console.log(
      '⚠️  Could not find job-level env: in deploy.yml, skipping sync\n'
    );
    return;
  }

  // Collect existing env entries
  const existingKeys = new Set<string>();
  let lastEntryIndex = envLineIndex;
  let indent = '      '; // default 6 spaces (job-level env)

  for (let i = envLineIndex + 1; i < lines.length; i++) {
    const line = lines[i];

    // Comments inside the block — keep scanning but don't advance lastEntryIndex
    if (line.trim().startsWith('#')) {
      lastEntryIndex = i;
      continue;
    }

    // Empty line — end of env block
    if (line.trim() === '') {
      break;
    }

    const entryMatch = line.match(/^(\s+)([A-Z_][A-Z0-9_]*):\s/);
    if (entryMatch) {
      indent = entryMatch[1];
      existingKeys.add(entryMatch[2]);
      lastEntryIndex = i;
      continue;
    }

    // Not an env entry → end of block
    break;
  }

  // Diff
  const missing = requiredKeys.filter((k) => !existingKeys.has(k));
  const extra = [...existingKeys].filter(
    (k) =>
      BUILD_PREFIXES.some((p) => k.startsWith(p)) && !requiredKeys.includes(k)
  );

  console.log('🔄 Syncing deploy.yml job-level env with .env.production...');
  console.log(
    `   .env.production: ${requiredKeys.length} build-time vars | deploy.yml: ${existingKeys.size} vars`
  );

  if (missing.length === 0 && extra.length === 0) {
    console.log('   ✅ deploy.yml is in sync\n');
    return;
  }

  if (extra.length > 0) {
    console.log(
      `   ⚠️  In deploy.yml but not in .env.production: ${extra.join(', ')}`
    );
  }

  if (missing.length > 0) {
    // Append missing entries
    const newLines = missing.map((k) => `${indent}${k}: \${{ secrets.${k} }}`);
    lines.splice(lastEntryIndex + 1, 0, ...newLines);
    fs.writeFileSync(DEPLOY_YML, lines.join('\n'), 'utf8');

    console.log(
      `   ✅ Added ${missing.length} var(s) to deploy.yml: ${missing.join(', ')}`
    );
    console.log('   📝 Remember to commit the updated deploy.yml\n');
  } else {
    console.log('');
  }
}

// ---------------------------------------------------------------------------
// Sync GitHub secrets
// ---------------------------------------------------------------------------

const DELAY_MS = 1500;
const MAX_RETRIES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getArgValue(shortFlag: string, longFlag: string): string | undefined {
  const args = process.argv.slice(2);

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (!arg) continue;

    if (arg === shortFlag || arg === longFlag) {
      return args[index + 1];
    }

    if (arg.startsWith(`${shortFlag}=`)) {
      return arg.slice(shortFlag.length + 1);
    }

    if (arg.startsWith(`${longFlag}=`)) {
      return arg.slice(longFlag.length + 1);
    }
  }

  return undefined;
}

function parseGitHubRepoFromUrl(remoteUrl: string): string | undefined {
  const normalized = remoteUrl.trim().replace(/\.git$/, '');
  const sshMatch = normalized.match(
    /^(?:git@|ssh:\/\/git@)github\.com[:/](.+\/.+)$/i
  );
  if (sshMatch) return sshMatch[1];

  const httpsMatch = normalized.match(/^https?:\/\/github\.com\/(.+\/.+)$/i);
  if (httpsMatch) return httpsMatch[1];

  return undefined;
}

function normalizeRepoIdentifier(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const repoFromUrl = parseGitHubRepoFromUrl(trimmed);
  if (repoFromUrl) return repoFromUrl;

  if (/^[^/\s]+\/[^/\s]+$/.test(trimmed)) {
    return trimmed.replace(/\.git$/, '');
  }

  return undefined;
}

function getGitRemoteUrl(remoteName: string, cwd: string): string | undefined {
  try {
    const output = execFileSync(
      'git',
      ['config', '--get', `remote.${remoteName}.url`],
      {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }
    );

    return output.trim() || undefined;
  } catch {
    return undefined;
  }
}

function resolveRepo(cwd: string): string {
  const repoOverride =
    getArgValue('-R', '--repo') ?? process.env.GITHUB_REPOSITORY;
  const normalizedOverride = repoOverride
    ? normalizeRepoIdentifier(repoOverride)
    : undefined;

  if (repoOverride && !normalizedOverride) {
    console.error(
      '❌ Invalid repo value. Use --repo owner/name or set GITHUB_REPOSITORY=owner/name.'
    );
    process.exit(1);
  }

  if (normalizedOverride) {
    return normalizedOverride;
  }

  const originUrl = getGitRemoteUrl('origin', cwd);
  const originRepo = originUrl ? parseGitHubRepoFromUrl(originUrl) : undefined;
  if (originRepo) {
    return originRepo;
  }

  try {
    const remotes = execFileSync('git', ['remote'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .split(/\r?\n/)
      .map((remote) => remote.trim())
      .filter(Boolean);

    for (const remote of remotes) {
      const remoteUrl = getGitRemoteUrl(remote, cwd);
      const repo = remoteUrl ? parseGitHubRepoFromUrl(remoteUrl) : undefined;
      if (repo) {
        return repo;
      }
    }
  } catch {
    // Ignore and show the explicit guidance below.
  }

  console.error(
    '❌ Could not determine the GitHub repo automatically. Use --repo owner/name.'
  );
  process.exit(1);
}

async function setSecret(
  key: string,
  value: string,
  cwd: string,
  repo: string
): Promise<boolean> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      execFileSync('gh', ['secret', 'set', key, '--repo', repo], {
        input: value,
        stdio: ['pipe', 'inherit', 'inherit'],
        cwd,
      });
      return true;
    } catch {
      if (attempt < MAX_RETRIES) {
        const waitMs = DELAY_MS * attempt;
        console.log(
          `   ⏳ Retry ${attempt}/${MAX_RETRIES} for ${key} (waiting ${waitMs}ms)...`
        );
        await sleep(waitMs);
      }
    }
  }
  return false;
}

async function main() {
  // Step 1: Sync deploy.yml env block with .env.production
  syncDeployYml();

  // Step 2: Push secrets to GitHub
  const envPath = path.join(__dirname, '..', '.env.production');
  const rootDir = path.join(__dirname, '..');

  if (!fs.existsSync(envPath)) {
    console.error('❌ .env.production not found');
    process.exit(1);
  }

  try {
    execFileSync('gh', ['--version'], { stdio: 'ignore' });
  } catch {
    console.error('❌ GitHub CLI (gh) is not installed or not in PATH');
    process.exit(1);
  }

  try {
    execFileSync('gh', ['auth', 'status'], { stdio: 'ignore' });
  } catch {
    console.error('❌ Not logged in to GitHub CLI. Run `gh auth login` first.');
    process.exit(1);
  }

  const repo = resolveRepo(rootDir);
  const env = parseEnvFile(envPath);
  const keys = Object.keys(env);
  const skipped: string[] = [];
  const failed: string[] = [];
  let successCount = 0;

  if (keys.length === 0) {
    console.log('No environment variables found in .env.production');
    process.exit(0);
  }

  console.log(`🔄 Syncing ${keys.length} secrets to GitHub Actions...`);
  console.log(`📦 Target GitHub repo: ${repo}\n`);

  for (const key of keys) {
    const value = env[key];

    if (value === '') {
      skipped.push(key);
      console.log(`⏭️  ${key} (empty, skipped)`);
      continue;
    }

    if (await setSecret(key, value, rootDir, repo)) {
      successCount++;
      console.log(`✅ ${key}`);
    } else {
      failed.push(key);
      console.error(`❌ Failed to set ${key}`);
    }

    await sleep(DELAY_MS);
  }

  console.log(`\n--- Summary ---`);
  console.log(`✅ Set: ${successCount}`);
  if (skipped.length > 0) {
    console.log(`⏭️  Skipped (empty): ${skipped.join(', ')}`);
  }
  if (failed.length > 0) {
    console.log(`❌ Failed: ${failed.join(', ')}`);
    process.exit(1);
  }
}

main();
