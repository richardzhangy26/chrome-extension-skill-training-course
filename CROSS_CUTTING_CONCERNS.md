# Cross-Cutting Concerns & Shared Utilities Map

## Overview

This document maps all shared utilities across `packages/` and how `pages/` (extension UI surfaces) consume them. It identifies common patterns, integration points, and the communication architecture.

---

## 1. Shared Packages Architecture

### Package Dependency Graph

```
┌─────────────────────────────────────────────────────────────┐
│                    pages/ (UI Surfaces)                      │
│  side-panel | popup | options | new-tab | devtools | etc.   │
└────────────────────┬────────────────────────────────────────┘
                     │ imports via @extension/*
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   Shared Packages Layer                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   @shared    │  │  @storage    │  │     @ui      │       │
│  │              │  │              │  │              │       │
│  │ • Hooks      │  │ • LLM Config │  │ • Components │       │
│  │ • Utils      │  │ • Agent Logs │  │ • Tailwind   │       │
│  │ • Types      │  │ • Sessions   │  │ • Spinner    │       │
│  │ • Constants  │  │ • Factory    │  │ • HOCs       │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │    @hmr      │  │ @dev-utils   │  │   @i18n      │       │
│  │              │  │              │  │              │       │
│  │ • Vite HMR   │  │ • Manifest   │  │ • Locales    │       │
│  │ • Plugins    │  │ • Zip Utils  │  │ • Strings    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                     │ imports via @extension/*
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              chrome-extension/ (Background)                   │
│  • Service Worker (background/index.ts)                      │
│  • API Gateway (message passing)                             │
│  • Manifest (manifest.ts → manifest.json)                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Detailed Package Exports

### `@extension/shared`
**Purpose**: Core utilities, hooks, domain logic, and type definitions.

| Export | Type | Usage |
|--------|------|-------|
| `colorfulLog` | Function | Colored console logging (build tools, runtime) |
| `useStorage` | Hook | Sync React state with `chrome.storage` |
| `initAppWithShadow` | Function | Inject React apps into Shadow DOM (content-ui) |
| `AgentApiClient` | Class | HTTP client for Polymas API calls |
| `AgentStateMachine` | Class | State transitions for training workflow |
| `withSuspense` | HOC | Wrap components with Suspense boundary |
| `withErrorBoundary` | HOC | Error boundary wrapper |
| `ScriptStep`, `LLMConfig`, `AgentLog` | Types | Domain models |
| `AGENT_STATES`, `STEP_TYPES` | Constants | Enum-like constants |

**Key Files**:
- `packages/shared/lib/hooks/useStorage.ts` - Storage sync hook
- `packages/shared/lib/agent/state-machine.ts` - State machine logic
- `packages/shared/lib/api/agent-api-client.ts` - API client
- `packages/shared/lib/utils/shadow-dom.ts` - Shadow DOM injection

---

### `@extension/storage`
**Purpose**: Persistence layer wrapping Chrome's `chrome.storage` API.

| Export | Type | Purpose |
|--------|------|---------|
| `llmConfigStorage` | StorageModule | LLM API key, model, endpoint |
| `agentLogStorage` | StorageModule | Training conversation history |
| `agentSessionStorage` | StorageModule | Current training session state |
| `createStorage` | Factory | Generic storage factory (get, set, subscribe) |

**Key Files**:
- `packages/storage/lib/impl/llm-config.ts` - LLM configuration storage
- `packages/storage/lib/impl/agent-log.ts` - Conversation logs
- `packages/storage/lib/impl/agent-session.ts` - Session state
- `packages/storage/lib/factory.ts` - Storage factory pattern

**Storage Schema**:
```typescript
// All storage modules follow this pattern:
interface StorageModule<T> {
  get(): Promise<T | null>;
  set(value: T): Promise<void>;
  subscribe(callback: (value: T | null) => void): () => void;
}
```

---

### `@extension/ui`
**Purpose**: Shared React components and design system.

| Export | Type | Purpose |
|--------|------|---------|
| `Button`, `Toggle`, `Input`, `Select` | Components | shadcn-based UI components |
| `LoadingSpinner` | Component | Loading indicator |
| `ErrorDisplay` | Component | Error message display |
| `withUI` | HOC | Tailwind CSS wrapper |
| `tailwindConfig` | Config | Unified Tailwind configuration |

**Key Files**:
- `packages/ui/lib/components/` - Shadcn component library
- `packages/ui/lib/hoc/with-ui.tsx` - Tailwind wrapper HOC
- `packages/tailwindcss-config/` - Shared Tailwind config

---

### `@extension/hmr`
**Purpose**: Hot Module Replacement for development.

| Export | Type | Purpose |
|--------|------|---------|
| `hmrPlugin` | Vite Plugin | Extension-specific HMR |
| `reloadExtension` | Function | Trigger extension reload |
| `refreshPage` | Function | Refresh current page |

**Key Files**:
- `packages/hmr/lib/vite-plugin.ts` - Vite HMR plugin

---

### `@extension/dev-utils`
**Purpose**: Build-time utilities.

| Export | Type | Purpose |
|--------|------|---------|
| `ManifestParser` | Class | Parse and generate manifest.json |
| `zipDirectory` | Function | Create ZIP archives |

**Key Files**:
- `packages/dev-utils/lib/manifest-parser.ts` - Manifest generation
- `packages/zipper/` - ZIP utility package

---

### `@extension/i18n`
**Purpose**: Internationalization support.

| Export | Type | Purpose |
|--------|------|---------|
| `useTranslation` | Hook | Access translated strings |
| `locales` | Object | Locale definitions |

**Key Files**:
- `packages/i18n/lib/locales/` - Translation files

---

## 3. Cross-Cutting Concerns

### 3.1 Storage & State Management

**Pattern**: All state is persisted to `chrome.storage.local` via the storage factory.

```typescript
// Example: Using storage in a component
import { llmConfigStorage } from '@extension/storage';
import { useStorage } from '@extension/shared';

const MyComponent = () => {
  const [config, setConfig] = useStorage(llmConfigStorage);
  
  return <div>{config?.apiKey}</div>;
};
```

**Concern**: Storage is **synchronous in reads** but **async in writes**. The `useStorage` hook handles this.

---

### 3.2 Error Handling

**Pattern**: Standardized error boundaries and error displays.

```typescript
// Wrap components with error boundary
import { withErrorBoundary } from '@extension/shared';
import { ErrorDisplay } from '@extension/ui';

const SafeComponent = withErrorBoundary(MyComponent, {
  fallback: <ErrorDisplay message="Something went wrong" />
});
```

**Concern**: Errors in content scripts must be caught separately (different execution context).

---

### 3.3 Logging

**Pattern**: Centralized logging via `colorfulLog`.

```typescript
import { colorfulLog } from '@extension/shared';

colorfulLog('info', 'Agent started', { taskId: '123' });
colorfulLog('error', 'API failed', { status: 500 });
```

**Concern**: Logs in background service worker are visible in `chrome://extensions` DevTools.

---

### 3.4 Type Safety

**Pattern**: Shared domain types across all packages.

```typescript
// packages/shared/lib/types/index.ts
export interface ScriptStep {
  id: string;
  type: 'question' | 'feedback' | 'end';
  content: string;
  nextStepId?: string;
}

export interface LLMConfig {
  apiKey: string;
  model: string;
  endpointId: string;
}

export interface AgentLog {
  id: string;
  taskId: string;
  messages: Array<{ role: 'user' | 'ai'; content: string }>;
  createdAt: number;
}
```

**Concern**: Type definitions must be kept in sync across packages.

---

### 3.5 Styling & Design System

**Pattern**: Unified Tailwind configuration + shadcn components.

```typescript
// All pages import from @extension/ui
import { Button } from '@extension/ui';
import { withUI } from '@extension/ui';

const MyPage = withUI(() => (
  <Button className="bg-blue-500">Click me</Button>
));
```

**Concern**: Shadow DOM injection (in content-ui) requires style isolation via `initAppWithShadow`.

---

### 3.6 API Communication

**Pattern**: Background service worker acts as API gateway.

```
┌──────────────────┐
│  pages/side-panel│
│  (UI Surface)    │
└────────┬─────────┘
         │ chrome.runtime.sendMessage()
         ▼
┌──────────────────────────────────┐
│ chrome-extension/background       │
│ (Service Worker - API Gateway)   │
│ • Handles CORS                   │
│ • Manages auth tokens            │
│ • Retries failed requests        │
└────────┬─────────────────────────┘
         │ fetch() to Polymas API
         ▼
┌──────────────────┐
│  Polymas API     │
│  (External)      │
└──────────────────┘
```

**Implementation**:
```typescript
// pages/side-panel/src/services/background-bridge.ts
export const apiRequest = async (endpoint: string, options?: RequestInit) => {
  return chrome.runtime.sendMessage({
    type: 'API_REQUEST',
    endpoint,
    options
  });
};
```

---

## 4. How pages/ Uses Shared Code

### 4.1 side-panel (Main Chat Interface)

**Key Imports**:
```typescript
import { useStorage } from '@extension/shared';
import { llmConfigStorage, agentLogStorage } from '@extension/storage';
import { Button, LoadingSpinner } from '@extension/ui';
import { useAgentChat } from './hooks/useAgentChat';
```

**Architecture**:
```
side-panel/
├── src/
│   ├── App.tsx                    # Main component
│   ├── hooks/
│   │   └── useAgentChat.ts        # Orchestration hook
│   ├── services/
│   │   └── background-bridge.ts   # API communication
│   └── components/
│       ├── ChatWindow.tsx
│       ├── InputBox.tsx
│       └── HistoryPanel.tsx
```

**Flow**:
1. User enters message in `InputBox`
2. `useAgentChat` hook processes it via `AgentStateMachine`
3. Calls `background-bridge.apiRequest()` to send to Polymas API
4. Response stored in `agentLogStorage`
5. UI updates via `useStorage` hook

---

### 4.2 popup (Quick Access)

**Key Imports**:
```typescript
import { useStorage } from '@extension/shared';
import { llmConfigStorage } from '@extension/storage';
import { Button } from '@extension/ui';
```

**Purpose**: Quick access to extension features (open side-panel, settings).

---

### 4.3 options (Settings Page)

**Key Imports**:
```typescript
import { useStorage } from '@extension/shared';
import { llmConfigStorage } from '@extension/storage';
import { Input, Button, Select } from '@extension/ui';
```

**Purpose**: Configure LLM settings, user roles, system prompts.

---

### 4.4 content-ui (Injected React Components)

**Key Imports**:
```typescript
import { initAppWithShadow } from '@extension/shared';
import { withUI } from '@extension/ui';
```

**Pattern**:
```typescript
// pages/content-ui/src/index.ts
const root = initAppWithShadow('my-extension-root');
root.render(
  <withUI>
    <MyInjectedComponent />
  </withUI>
);
```

**Concern**: Shadow DOM isolation prevents style conflicts with host page.

---

### 4.5 content (Content Script)

**Purpose**: Inject scripts into page context (not React).

**Key Imports**:
```typescript
import { colorfulLog } from '@extension/shared';
```

---

### 4.6 devtools & devtools-panel

**Purpose**: Chrome DevTools integration.

**Key Imports**:
```typescript
import { useStorage } from '@extension/shared';
import { Button } from '@extension/ui';
```

---

## 5. Integration Points

### 5.1 Background Service Worker

**File**: `chrome-extension/src/background/index.ts`

**Responsibilities**:
- Listen for messages from pages via `chrome.runtime.onMessage`
- Forward API requests to Polymas backend
- Handle authentication (token refresh, etc.)
- Manage extension lifecycle

**Example**:
```typescript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'API_REQUEST') {
    fetch(request.endpoint, request.options)
      .then(res => res.json())
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
  }
  return true; // Keep channel open for async response
});
```

---

### 5.2 Manifest Generation

**File**: `chrome-extension/manifest.ts`

**Pattern**: Single source of truth for extension configuration.

```typescript
// manifest.ts (TypeScript)
export const manifest = {
  manifest_version: 3,
  name: 'Polymas AI Training Assistant',
  permissions: ['storage', 'runtime', 'scripting'],
  action: { default_popup: 'popup.html' },
  side_panel: { default_path: 'side-panel.html' },
  // ... more config
};
```

**Build Step**: Vite converts `manifest.ts` → `manifest.json` during build.

**⚠️ Important**: Never edit `manifest.json` directly. Always edit `manifest.ts`.

---

### 5.3 Module Management

**Tool**: `pnpm module-manager`

**Purpose**: Add/remove extension UI pages safely.

```bash
# Remove a page (archives folder, updates manifest)
pnpm module-manager -d popup

# Recover a removed page
pnpm module-manager -r popup
```

---

## 6. Data Flow Diagram

### Training Session Flow

```
┌─────────────────────────────────────────────────────────────┐
│ User visits Polymas training page (URL has trainTaskId)     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ side-panel opens, detects trainTaskId from URL              │
│ (via content script message passing)                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ useAgentChat hook initializes:                              │
│ 1. Fetch training script from Polymas API                   │
│ 2. Load LLM config from llmConfigStorage                    │
│ 3. Initialize AgentStateMachine                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ User sends message in chat input                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ useAgentChat processes message:                             │
│ 1. Update AgentStateMachine state                           │
│ 2. Call background-bridge.apiRequest() to Polymas API      │
│ 3. Get AI response                                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Store conversation in agentLogStorage                       │
│ (chrome.storage.local)                                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ UI updates via useStorage hook (reactive)                   │
│ ChatWindow displays new message                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Common Patterns & Best Practices

### 7.1 Using Storage in Components

```typescript
import { useStorage } from '@extension/shared';
import { llmConfigStorage } from '@extension/storage';

const MyComponent = () => {
  const [config, setConfig] = useStorage(llmConfigStorage);
  
  if (!config) return <div>Loading...</div>;
  
  return (
    <div>
      <p>Model: {config.model}</p>
      <button onClick={() => setConfig({ ...config, model: 'gpt-4' })}>
        Change Model
      </button>
    </div>
  );
};
```

### 7.2 Communicating with Background

```typescript
// pages/side-panel/src/services/background-bridge.ts
export const apiRequest = async (endpoint: string, options?: RequestInit) => {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: 'API_REQUEST', endpoint, options },
      (response) => {
        if (response?.success) {
          resolve(response.data);
        } else {
          reject(new Error(response?.error || 'Unknown error'));
        }
      }
    );
  });
};
```

### 7.3 Wrapping Components with HOCs

```typescript
import { withErrorBoundary, withSuspense } from '@extension/shared';
import { withUI } from '@extension/ui';

const SafeComponent = withUI(
  withErrorBoundary(
    withSuspense(MyComponent, <LoadingSpinner />),
    { fallback: <ErrorDisplay /> }
  )
);
```

### 7.4 Injecting into Shadow DOM

```typescript
import { initAppWithShadow } from '@extension/shared';
import { withUI } from '@extension/ui';

const root = initAppWithShadow('my-extension-root');
root.render(
  <withUI>
    <MyInjectedComponent />
  </withUI>
);
```

---

## 8. Dependency Resolution

### Import Paths

**✅ Correct** (use `@extension/*` alias):
```typescript
import { useStorage } from '@extension/shared';
import { llmConfigStorage } from '@extension/storage';
import { Button } from '@extension/ui';
```

**❌ Wrong** (relative paths across workspaces):
```typescript
import { useStorage } from '../../../packages/shared/lib/hooks';
```

### Path Alias Configuration

**File**: `tsconfig.json` (root)
```json
{
  "compilerOptions": {
    "paths": {
      "@extension/*": ["./packages/*/lib"]
    }
  }
}
```

---

## 9. Build & Development Workflow

### Development

```bash
pnpm dev              # Watch mode with HMR
```

**What happens**:
1. Vite watches all packages and pages
2. Changes trigger HMR reload in extension
3. `packages/hmr` plugin handles extension-specific reload logic

### Production Build

```bash
pnpm build            # Production build
pnpm zip              # Build + create ZIP
```

**What happens**:
1. Turbo orchestrates parallel builds across workspaces
2. `manifest.ts` → `manifest.json`
3. All packages bundled into `dist/`
4. ZIP created for distribution

---

## 10. Testing Shared Utilities

### Unit Tests

```typescript
// packages/shared/lib/hooks/__tests__/useStorage.test.ts
import { renderHook, act } from '@testing-library/react';
import { useStorage } from '../useStorage';

describe('useStorage', () => {
  it('should sync with chrome.storage', async () => {
    const { result } = renderHook(() => useStorage(mockStorage));
    
    act(() => {
      result.current[1]({ key: 'value' });
    });
    
    expect(mockStorage.set).toHaveBeenCalledWith({ key: 'value' });
  });
});
```

### E2E Tests

```bash
pnpm e2e              # Run WebdriverIO tests
```

**Test Location**: `tests/e2e/specs/`

---

## 11. Troubleshooting

### Issue: Import path not resolved

**Solution**: Ensure using `@extension/*` alias, not relative paths.

### Issue: Storage not persisting

**Solution**: Check that `chrome.storage.local` permission is in `manifest.ts`.

### Issue: HMR not working

**Solution**: Restart dev server: `pnpm dev`

### Issue: Type errors in shared packages

**Solution**: Run `pnpm type-check` to validate all packages.

---

## 12. Summary Table

| Concern | Package | Key Export | Usage |
|---------|---------|------------|-------|
| **State Management** | `@extension/storage` | `useStorage` hook | Persist UI state |
| **API Communication** | `@extension/shared` | `AgentApiClient` | Call Polymas API |
| **UI Components** | `@extension/ui` | `Button`, `Input`, etc. | Build UIs |
| **Styling** | `@extension/ui` | `withUI` HOC | Apply Tailwind |
| **Error Handling** | `@extension/shared` | `withErrorBoundary` | Catch errors |
| **Logging** | `@extension/shared` | `colorfulLog` | Debug output |
| **Type Definitions** | `@extension/shared` | `ScriptStep`, `LLMConfig` | Type safety |
| **Shadow DOM** | `@extension/shared` | `initAppWithShadow` | Inject into pages |
| **Hot Reload** | `@extension/hmr` | `hmrPlugin` | Dev productivity |
| **Manifest** | `chrome-extension/` | `manifest.ts` | Extension config |

---

## 13. Next Steps

1. **Explore a specific package**: Check `packages/shared/lib/` for detailed implementations.
2. **Add a new shared utility**: Create in appropriate package, export from `index.ts`, use `@extension/*` alias.
3. **Create a new page**: Use `pnpm module-manager` to scaffold, import shared utilities.
4. **Debug communication**: Check `chrome://extensions` → Service Worker logs for background errors.

