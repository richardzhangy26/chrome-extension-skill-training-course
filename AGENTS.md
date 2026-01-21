# Repository Guidelines

## Project Structure & Module Organization
- `chrome-extension/` holds the MV3 manifest source (`manifest.ts`), background service worker (`src/background`), and static assets (`public/`).
- `pages/` contains UI surfaces: `popup/`, `side-panel/`, `options/`, `new-tab/`, `devtools/`, `devtools-panel/`, plus injected UIs in `content-ui/` and `content-runtime/`.
- `packages/` contains shared libraries and tooling (e.g., `shared/`, `storage/`, `ui/`, `hmr/`, `dev-utils/`, `module-manager/`).
- `tests/e2e/` contains WebdriverIO test config and specs (`tests/e2e/specs/`).
- `dist/` is generated build output (load this folder in Chrome for testing).

## Build, Test, and Development Commands
- `pnpm dev`: development build with watch/HMR across workspaces.
- `pnpm build`: production build into `dist/`.
- `pnpm build:firefox`: Firefox build output.
- `pnpm zip`: build and package `dist` into a zip under `dist-zip/`.
- `pnpm lint`: run ESLint across packages via Turborepo.
- `pnpm format`: run Prettier formatting.
- `pnpm type-check`: TypeScript type checks across workspaces.
- `pnpm e2e`: builds and runs end-to-end tests.

## Coding Style & Naming Conventions
- TypeScript + React (ESM); keep files consistent with existing naming.
- Indentation is 2 spaces; keep semicolons and trailing commas as in the codebase.
- React components use PascalCase; hooks use `useX` naming (e.g., `useAgentChat`).
- Linting/formatting: `eslint.config.ts` and Prettier via `pnpm lint` and `pnpm format`.

## ESLint Rules (Strict)

This project enforces strict ESLint rules. Pre-commit hooks will block commits with errors.

### Function Style (`func-style`)
- **Use arrow function expressions**, not function declarations
```typescript
// ❌ Wrong
function MyComponent() { ... }

// ✅ Correct
const MyComponent = () => { ... };
```

### Export Position (`import-x/exports-last`)
- **All exports must be at the end of the file**
```typescript
// ❌ Wrong - exports in the middle
export const foo = 1;
const bar = 2;

// ✅ Correct - exports at the end
const foo = 1;
const bar = 2;
export { foo };
```

### Accessibility (`jsx-a11y/*`)
- Clickable non-interactive elements need keyboard support:
```tsx
// ✅ Required attributes for clickable divs
<div
  onClick={handleClick}
  onKeyDown={e => e.key === 'Enter' && handleClick()}
  role="button"
  tabIndex={0}
  aria-label="Description"
/>
```
- Form labels must be associated with controls via `htmlFor` and `id`

### Unused Variables (`@typescript-eslint/no-unused-vars`)
```typescript
// ❌ Wrong
} catch (e) { console.log('error'); }

// ✅ Correct
} catch { console.log('error'); }
```

## Testing Guidelines
- E2E tests use WebdriverIO + Mocha (`tests/e2e/`).
- Place specs in `tests/e2e/specs/*.ts`.
- Run locally with `pnpm e2e` or `pnpm -F @extension/e2e e2e` for scoped runs.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (example in history: `feat: ...`). Prefer short, descriptive subjects.
- PRs should include: a concise summary, test results/commands run, and screenshots for UI changes.
- Avoid committing `dist/` unless explicitly required for a release artifact.

## Environment Notes
- Node.js >= 22.15.1 and `pnpm@10.11.0` (see `package.json`).
- Load the extension for manual testing by selecting the `dist/` folder in `chrome://extensions`.
