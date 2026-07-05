# AI 代理规则

## 语言偏好
- 所有回复使用中文。

## 设计原则
- 遵循 DRY、SOLID、KISS。
- 优先沿用本仓已有抽象、hook、storage wrapper、UI 组件和 workspace 约定。
- 文档或代码改动要最小化范围，不要顺手重构无关模块。

## Project Structure & Module Organization
- `chrome-extension/` holds the MV3 manifest source (`manifest.ts`), background service worker (`src/background`), and static assets (`public/`). Do not edit generated `manifest.json`.
- `pages/side-panel/` is the primary extension UI: text training, voice training, Admin Web login, configuration modals, simulation/knowledge-base controls, and history UI.
- `pages/` also contains other extension surfaces: `popup/`, `options/`, `new-tab/`, `devtools/`, `devtools-panel/`, `content-ui/`, and `content-runtime/`.
- `packages/` contains shared extension libraries and tooling, including `shared/`, `storage/`, `ui/`, `hmr/`, `dev-utils/`, and `module-manager/`.
- `admin_web/` is a first-class TanStack Start application deployed to Cloudflare Workers. It owns Better Auth login, D1-backed extension LLM configuration, and the `/settings/extension` web UI.
- `.github/workflows/` contains repository-root GitHub Actions. The admin web deploy workflow must live here even though its working directory is `admin_web/`.
- `tests/e2e/` contains WebdriverIO e2e config and specs.
- `dist/` and `dist-zip/` are generated extension artifacts.

## Architecture Overview

### Two Backend Channels
- **Polymas channel**: training content and chat/voice runtime. The extension reads the `ai-poly` cookie from `hike-teaching-center.polymas.com`, then calls `https://cloudapi.polymas.com` through the background `API_REQUEST` path.
- **Admin Web channel**: extension account login and LLM configuration sync. The side panel logs in/registers against Admin Web Better Auth, stores the bearer token in `auth-session-storage`, and calls Admin Web through background `ADMIN_WEB_REQUEST`.
- These channels are independent. Do not mix the Polymas cookie auth path with Admin Web bearer auth.

### Primary Data Flow
- User visits a Polymas training page with `trainTaskId`.
- Side panel extracts `trainTaskId`.
- Text mode uses `useAgentChat` plus Polymas REST APIs.
- Voice mode uses `useVoiceAgentChat`, the Polymas training-flow WebSocket, and the local TTS/audio pipeline.
- If the user is logged in to Admin Web, `useAdminWebAuth` pulls the server LLM config into `llmConfigStorage`; configuration UI becomes read-only in the extension.
- If the user is logged out, extension configuration remains local and editable.
- First login with no server config seeds Admin Web from the current local `llmConfigStorage`; after that, Admin Web is the source of truth for config.

### Key Components
All paths are under `pages/side-panel/src/` unless otherwise noted.

| Layer | File | Responsibility |
| --- | --- | --- |
| Background | `chrome-extension/src/background/index.ts` | Auth cookies, API proxy, `trainTaskId` extraction, `API_REQUEST`, `ADMIN_WEB_REQUEST` |
| Text Chat Hook | `hooks/useAgentChat.ts` | Text-mode state machine: `IDLE -> FETCHING_STEPS -> RUNNING_CARD -> CHATTING -> COMPLETED` |
| Voice Chat Hook | `hooks/useVoiceAgentChat.ts` | Voice-mode state machine driving WS + TTS pipeline |
| LLM Service | `services/llm-service.ts` | LLM request payloads, model config, student answers, staged dialogue simulation |
| Bridge | `services/background-bridge.ts` | Side panel to background messaging |
| Admin Web Service | `services/admin-web-service.ts` | sign up/sign in/sign out/session/config calls over `ADMIN_WEB_REQUEST` |
| Auth Hook | `hooks/useAdminWebAuth.ts` | Admin Web login state, config pull-down, first-login seed |
| Main UI | `SidePanel.tsx` | Text/voice mode switch, chat UI, auth entry, configuration modals |
| Admin Web API | `admin_web/src/routes/api/extension/config.ts` | Bearer-authenticated extension LLM config route |
| Admin Web UI | `admin_web/src/routes/settings/extension.tsx` | Web form for extension LLM configuration |

See scoped docs for details:
- `pages/side-panel/AGENTS.md`
- `chrome-extension/AGENTS.md`
- `packages/storage/AGENTS.md`
- `admin_web/AGENTS.md`
- `.github/AGENTS.md`

## Storage Layer
The storage wrapper lives in `packages/storage/lib/base/` and should be used instead of direct `chrome.storage` access.

```typescript
const storage = createStorage<DataType>('key', defaultValue, {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});
```

- React consumers use the `useSyncExternalStore`-style `getSnapshot()` and `subscribe()` pattern.
- All storage modules must be exported from `packages/storage/lib/impl/index.ts`.
- Key modules:
  - `agent-session-storage`: current `trainTaskId/sessionId/stepId`.
  - `agent-chat-storage`: current chat buffer.
  - `agent-log-storage`: persisted conversation logs shown in history.
  - `llm-config-storage`: API credentials, model settings, student profiles, simulation/knowledge-base content, and voice/TTS settings.
  - `auth-session-storage`: Admin Web bearer token and user identity.

## Dialogue Simulation, Knowledge Base, And Voice Mode
- `SimulationConfigModal.tsx` accepts historical logs in `AI: / 用户:` format, can generate dialogue stage-by-stage through the LLM, and stores the result in `llmConfigStorage`.
- `SimulationConfigBar.tsx` is the shared text/voice UI for simulation and knowledge-base toggles.
- Text and voice modes share the same simulation/knowledge-base config. Voice mode does not need separate runtime logic: AI student generation flows through `generateStudentAnswer()` and `buildStudentRoleSystemPrompt()`.
- Stage-by-stage generation is intentional. Do not revert to one-shot generation for long scripts because it previously caused silent truncation.

## Admin Web Integration
- Better Auth bearer token is returned in the `set-auth-token` response header and persisted by `auth-session-storage`.
- Admin Web config is stored in D1 table `userLlmConfig` as a JSON string validated by `admin_web/src/lib/llm-config-schema.ts`.
- The extension route is `GET/POST /api/extension/config`, authenticated by `Authorization: Bearer <token>`.
- The web editing page is `/settings/extension`.
- Login state makes extension config modals read-only; logged-out mode remains local-editable.
- A 401 from Admin Web should clear local auth session and make the user log in again.

## Framework Quirks & Important Conventions
- **Do not edit `manifest.json` directly.** Always edit `chrome-extension/manifest.ts`.
- **Workspace imports**: use `@extension/*` across extension packages. Do not jump across workspace boundaries with deep relative paths.
- **Admin Web imports**: use `@/` for `admin_web/src` imports.
- **Feature deletion**: use `pnpm module-manager -d <feature-name>` instead of manually deleting extension UI packages.
- **Dependency management**:
  - Root extension workspace: `pnpm i <pkg> -w` or `pnpm i <pkg> -F <workspace-name>`.
  - Admin Web: run from `admin_web/` and respect its own lockfile/package manager.
- **Environment variables**:
  - Extension envs live under `packages/env`.
  - Admin Web server envs are Cloudflare Worker bindings/secrets; client envs use `VITE_`.
- **Tailwind**: extension shared Tailwind config lives in `packages/tailwindcss-config`; do not duplicate it per workspace.
- **Chat UI styling**: keep existing message bubble gradients, asymmetric rounded corners, and animation style unless a task explicitly changes the design.

## Build, Test, And Development Commands

### Root Extension Workspace
- `pnpm dev`: development build with watch/HMR across extension workspaces.
- `pnpm build`: production build into `dist/`.
- `pnpm build:firefox`: Firefox build output.
- `pnpm zip`: build and package `dist` into `dist-zip/`.
- `pnpm clean`: cleans `dist`, `node_modules`, and `.turbo`.
- `pnpm clean:install`: deep clean and reinstall.
- `pnpm lint`: ESLint across packages via Turborepo.
- `pnpm format`: Prettier formatting.
- `pnpm type-check`: TypeScript type checks across workspaces.
- `pnpm e2e`: build and run WebdriverIO e2e tests.

### Admin Web
Run these from `admin_web/`.

- `pnpm dev`: TanStack Start dev server on port 3000.
- `pnpm build`: production Worker build.
- `pnpm deploy`: build and deploy to Cloudflare Workers.
- `pnpm check`: Biome check, read-only.
- `pnpm lint`: Biome check with writes.
- `pnpm format`: Biome format.
- `pnpm db:generate`: generate Drizzle migrations.
- `pnpm db:migrate:local`: apply migrations to local D1.
- `pnpm db:migrate:remote`: apply migrations to remote D1.
- `pnpm sync-github-secrets`: sync GitHub Actions secrets from production env.

## Coding Style & Naming Conventions
- Root extension code is TypeScript + React ESM.
- Indentation is 2 spaces; keep semicolons and trailing commas consistent with nearby code.
- React components use PascalCase; hooks use `useX`.
- Root ESLint is strict:
  - Use arrow function expressions, not function declarations.
  - Put exports at the end of the file.
  - Clickable non-interactive JSX elements need keyboard support, role, tabIndex, and accessible labels.
  - Avoid unused catch variables: use `catch {}` when the error is not used.
- Admin Web uses Biome and its own style rules; follow `admin_web/AGENTS.md`.

## Testing Guidelines
- Prefer scoped verification for touched workspaces first, then repo-wide checks when useful.
- For side panel/storage changes, useful checks include:
  - `pnpm -F @extension/sidepanel lint`
  - `pnpm -F @extension/sidepanel type-check`
  - `pnpm -F @extension/storage lint`
  - `pnpm -F @extension/storage type-check`
- For Admin Web changes, use `pnpm check` and `pnpm build` from `admin_web/`.
- For docs-only changes, `git diff --check` is usually sufficient unless code snippets or generated docs need more validation.

## Commit & Pull Request Guidelines
- Follow Conventional Commits.
- PRs should include summary, test results/commands run, and screenshots for UI changes.
- Avoid committing `dist/` unless explicitly required for a release artifact.

## Environment Notes
- Root extension workspace uses Node.js >= 22.15.1 and `pnpm@10.11.0`.
- `admin_web/` uses its own `packageManager` (`pnpm@10.30.3`) and lockfile.
- Load the extension manually from `dist/` in `chrome://extensions`.
- If HMR freezes, restart the dev server or kill the stuck `turbo` process.
- Background service worker has no DOM access; use `chrome.*` APIs only there.
