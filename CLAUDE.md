# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome/Firefox extension built with **React 19**, **TypeScript**, **Vite 6**, and **Turborepo**. It uses **Manifest V3** and includes a custom AI agent chat system integrated with the Polymas teaching platform.

**Key Technology**: Monorepo managed by Turborepo with pnpm workspaces.

## Prerequisites

- **Node.js**: >= 22.15.1 (check `.nvmrc`)
- **Package Manager**: pnpm 10.11.0+ (install globally: `npm install -g pnpm`)
- **WSL Required on Windows**: Development must run in WSL environment

## Essential Commands

### Development
```bash
# Chrome development (with HMR)
pnpm dev

# Firefox development
pnpm dev:firefox

# Production build
pnpm build              # Chrome
pnpm build:firefox      # Firefox

# Create zip for distribution
pnpm zip
pnpm zip:firefox
```

### Type Checking & Linting
```bash
pnpm type-check         # Type check all packages
pnpm lint               # Lint all packages
pnpm lint:fix           # Auto-fix linting issues
pnpm format             # Format with Prettier
```

### Package Management
```bash
# Install dependency at root
pnpm i <package> -w

# Install for specific module (e.g., side-panel)
pnpm i <package> -F side-panel

# Clean everything
pnpm clean              # Clean dist, node_modules, turbo cache
pnpm clean:install      # Clean + fresh install
```

### Testing
```bash
pnpm e2e                # End-to-end tests (creates zip first)
```

### Version Management
```bash
pnpm update-version <version>    # Update extension version globally
```

### Module Management
```bash
pnpm module-manager     # Enable/disable extension modules interactively
```

## Architecture Overview

### Monorepo Structure

**3 Main Directories:**

1. **`chrome-extension/`** - Extension configuration
   - `manifest.ts` - Generates manifest.json (edit this, not manifest.json directly)
   - `src/background/` - Service worker for background tasks
   - `public/` - Icons and static assets

2. **`pages/`** - Extension UI pages (each is a separate entry point)
   - `popup/` - Toolbar popup
   - `side-panel/` - Side panel (Chrome 114+) - **Main chat interface**
   - `options/` - Settings page
   - `content/` - Content scripts injected into pages
   - `content-ui/` - React components injected into pages
   - `new-tab/` - Override new tab page
   - `devtools/` + `devtools-panel/` - DevTools extensions

3. **`packages/`** - Shared libraries
   - `storage/` - Chrome storage wrapper with type safety and live updates
   - `shared/` - Shared types, constants, utilities
   - `ui/` - Reusable React components
   - `i18n/` - Internationalization (edit `packages/i18n/locales/`)
   - `hmr/` - Custom hot module reload for Chrome extensions
   - `vite-config/` - Shared Vite configuration
   - `tailwind-config/` - Shared Tailwind setup

### AI Agent Chat System Architecture

**Purpose**: Integrates with Polymas teaching platform for AI-powered ability training.

**Key Components:**

1. **Background Script** (`chrome-extension/src/background/index.ts`)
   - Handles authentication via cookies from `hike-teaching-center.polymas.com`
   - Proxies API requests to `cloudapi.polymas.com`
   - Extracts `trainTaskId` from URL parameters
   - Message types: `GET_AUTH`, `EXTRACT_TRAIN_TASK_ID`, `API_REQUEST`

2. **Side Panel** (`pages/side-panel/src/`)
   - Main chat UI with message bubbles, input controls
   - Hook: `useAgentChat.ts` - Manages conversation workflow
   - Service: `background-bridge.ts` - Communicates with background script

3. **Storage Layer** (`packages/storage/lib/impl/`)
   - `agent-session-storage.ts` - Session state (trainTaskId, sessionId, stepId)
   - `agent-chat-storage.ts` - Chat message history
   - Uses Chrome's storage API with live synchronization

4. **Shared Logic** (`packages/shared/lib/agent/`)
   - `types.ts` - TypeScript interfaces
   - `constants.ts` - API endpoints, storage keys
   - Workflow states: IDLE → FETCHING_STEPS → RUNNING_CARD → CHATTING → COMPLETED

**Workflow:**
1. User visits page with `trainTaskId` parameter
2. Side panel auto-detects and extracts task ID
3. User clicks "开始训练" to fetch training steps
4. Background script authenticates and calls API
5. Chat conversation begins with AI assistant
6. User can manually respond or use AI auto-generate feature

### Storage Pattern

This project uses a custom storage abstraction (`packages/storage/lib/base/`):

```typescript
const storage = createStorage<DataType>(
  'storage-key',
  defaultValue,
  {
    storageEnum: StorageEnum.Local,  // or Session
    liveUpdate: true,  // Auto-sync across extension contexts
  }
);

// React integration via useSyncExternalStore
const data = storage.getSnapshot();
storage.subscribe(() => /* react to changes */);
```

**Important**: All storage modules must be exported in `packages/storage/lib/impl/index.ts`.

## Development Workflow

### Making Changes

1. **Edit source files** in `pages/` or `packages/`
2. **HMR auto-reloads** the extension (no manual refresh needed)
3. **If HMR freezes**: Restart dev server, or kill `turbo` process if you get grpc errors

### Adding New Pages

1. Create folder in `pages/` (copy existing page as template)
2. Add entry in `chrome-extension/manifest.ts`
3. Turborepo auto-detects and builds it

### Adding Dependencies

```bash
# For a specific page/package
pnpm i react-query -F side-panel

# For shared package
pnpm i axios -F @extension/shared
```

### Environment Variables

- Edit `packages/env/.env.defaults` for defaults
- Add to `packages/env/src/index.ts` to make available
- Access via `import { ENV_VAR } from '@extension/env'`

## Common Pitfalls

1. **Don't edit `manifest.json` directly** - Edit `manifest.ts` instead
2. **Import paths**: Use `@extension/` aliases (e.g., `@extension/storage`)
3. **React 19**: Uses new `react-compiler` - avoid legacy patterns
4. **Tailwind**: Extend via `packages/tailwind-config`, don't duplicate configs
5. **Storage must export** in `packages/storage/lib/impl/index.ts` to be accessible
6. **Background script**: Runs as service worker (no DOM access, use chrome APIs)
7. **Windows users**: Must run `pnpm dev` as administrator

## Loading Extension in Browser

### Chrome
1. Build: `pnpm build`
2. Go to `chrome://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked" → Select `dist/` folder
5. After code changes: Rebuild and click refresh icon on extension card

### Firefox
1. Build: `pnpm build:firefox`
2. Go to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on"
4. Select `dist/manifest.json`
5. **Note**: Extension disappears after browser close (temporary mode)

## Debugging

- **Side Panel**: Right-click panel → Inspect
- **Background Script**: Go to `chrome://extensions` → Click "service worker" under your extension
- **Content Scripts**: Open page DevTools → Console shows injected script logs
- **Popup**: Right-click extension icon → Inspect popup

## Project-Specific Notes

### Polymas Integration

- **Auth Cookie**: `ai-poly` from `hike-teaching-center.polymas.com`
- **API Base**: `https://cloudapi.polymas.com`
- **Required URL Param**: `trainTaskId` (e.g., `?trainTaskId=g2dlgQ4JOYimgZnNXxkb`)
- **Permissions**: Extension needs `cookies` and `activeTab` in manifest

### Tailwind Classes in Side Panel

The chat UI uses gradient backgrounds, rounded corners with asymmetric radii (`rounded-br-md`), and animations. Keep styling consistent with existing message bubble design.

### Module Management

To disable unused extension features (popup, devtools, etc.):
```bash
pnpm module-manager
# Follow interactive prompts
```

## Build Artifacts

- `dist/` - Built extension (gitignored)
- `dist-zip/` - Zipped extension for distribution
- `.turbo/` - Turborepo cache

---

**For more details**: See README.md or join [Discord community](https://discord.gg/4ERQ6jgV9a).
