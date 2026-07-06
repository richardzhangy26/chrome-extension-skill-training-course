# .github Agent Guide

## Overview
`.github/` contains repository-level GitHub configuration. The important workflow today is Admin Web deployment to Cloudflare Workers.

## Admin Web Deploy Workflow
File: `.github/workflows/deploy.yml`

- The workflow must live at repository root. GitHub Actions does not discover workflows inside `admin_web/.github/`.
- The job defaults should run commands from `admin_web`:

```yaml
defaults:
  run:
    working-directory: admin_web
```

- Trigger deployment only for relevant paths:
  - `admin_web/**`
  - `.github/workflows/deploy.yml`
- Keep `concurrency` so only one production deployment runs at a time.
- Keep Cloudflare credentials and client `VITE_*` variables sourced from GitHub secrets.

## pnpm Setup Rule
`admin_web` has its own `packageManager` (`pnpm@10.30.3`) while the root extension workspace uses a different pnpm version.

Use:

```yaml
- name: Setup pnpm
  uses: pnpm/action-setup@v5
  with:
    package_json_file: admin_web/package.json
```

Do not also set `version:`. Pinning `version:` while `package_json_file` or a root `packageManager` is present can recreate the PR #6 failure:
`Multiple versions of pnpm specified`.

## Node And Cache
- Use Node 22 for Admin Web deploys.
- Cache pnpm with `cache-dependency-path: admin_web/pnpm-lock.yaml`.
- Install with `pnpm install --frozen-lockfile` from `admin_web`.

## Anti-Patterns
- Do not run Admin Web deploy commands from the repository root.
- Do not use the root lockfile or root package manager for Admin Web CI.
- Do not broaden deploy triggers to all repository changes unless the release process explicitly changes.
