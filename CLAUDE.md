# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome/Firefox extension built with **React 19**, **TypeScript**, **Vite 6**, **Turborepo** (pnpm workspaces), using **Manifest V3**. Integrates with the Polymas teaching platform for AI-powered ability training, featuring an AI agent chat system with dialogue simulation and student profile role-playing.

## Prerequisites

- **Node.js**: >= 22.15.1 (check `.nvmrc`)
- **Package Manager**: pnpm 10.11.0+
- **WSL Required on Windows**

## Essential Commands

```bash
# Development
pnpm dev                # Chrome dev with HMR
pnpm dev:firefox        # Firefox dev
pnpm build              # Production build (Chrome)
pnpm build:firefox      # Production build (Firefox)

# Quality
pnpm type-check         # Type check all packages
pnpm lint               # Lint all packages
pnpm lint:fix           # Auto-fix linting issues
pnpm format             # Format with Prettier
pnpm e2e                # End-to-end tests

# Package management
pnpm i <pkg> -w                 # Install at root
pnpm i <pkg> -F side-panel      # Install for specific module
pnpm clean                      # Clean dist, node_modules, turbo cache
pnpm clean:install              # Clean + fresh install

# Utilities
pnpm update-version <version>   # Update extension version globally
pnpm module-manager             # Enable/disable extension modules
```

## Architecture Overview

### Monorepo Structure

1. **`chrome-extension/`** — Extension configuration
   - `manifest.ts` — Generates manifest.json (**edit this, not manifest.json directly**)
   - `src/background/` — Service worker (auth, API proxy, message handling)

2. **`pages/`** — Extension UI pages (each is a separate Vite entry point)
   - `side-panel/` — **Main chat interface** (Chrome 114+), the primary development target
   - `popup/`, `options/`, `content/`, `content-ui/`, `new-tab/`, `devtools/`, `devtools-panel/`

3. **`packages/`** — Shared libraries
   - `storage/` — Chrome storage wrapper with type safety and live updates
   - `shared/` — Types, constants, utilities (`packages/shared/lib/agent/`)
   - `ui/`, `i18n/`, `hmr/`, `vite-config/`, `tailwind-config/`

4. **`scripts/`** — Python utilities for dialogue simulation testing
   - `simulate_llm_dialogue_test.py` — Full simulation with configurable profiles and API integration
   - `simulate_chain.py` — Simplified round-based chain simulation
   - `replay_chain.py` — Replay logged dialogue sequences with timestamp reconstruction

### AI Agent Chat System

**Data Flow**: User visits page with `trainTaskId` → Side panel extracts it → Background script authenticates via `ai-poly` cookie → API calls to `cloudapi.polymas.com` → Chat conversation with AI assistant.

**Key Components:**

| Layer | File | Responsibility |
|-------|------|---------------|
| Background | `chrome-extension/src/background/index.ts` | Auth cookies, API proxy, trainTaskId extraction. Messages: `GET_AUTH`, `EXTRACT_TRAIN_TASK_ID`, `API_REQUEST` |
| Chat Hook | `pages/side-panel/src/hooks/useAgentChat.ts` | Conversation workflow state machine: IDLE → FETCHING_STEPS → RUNNING_CARD → CHATTING → COMPLETED |
| LLM Service | `pages/side-panel/src/services/llm-service.ts` | AI dialogue generation, model management, student answer generation |
| Bridge | `pages/side-panel/src/services/background-bridge.ts` | Side panel ↔ background script communication |
| Main UI | `pages/side-panel/src/SidePanel.tsx` | Chat UI with 5 sub-components (Header, MessageBubble, MessageList, ChatInput, StartButton) + 5 modals |

### LLM Service Layer (`llm-service.ts`)

Core orchestration for AI-generated dialogue:

- **`generateStudentAnswer()`** — Generates role-appropriate student responses given conversation history and student profile
- **`generateSimulationDialogueRecord()`** — Auto-generates complete simulated dialogue logs for training scripts, with intelligent model fallback chain (`GENERATOR_MODEL_PREFERENCES`)
- **`testLLMConfig()`** — Validates API connectivity
- **`fetchAvailableTextModels()`** — Discovers available text models, filters out non-text models via `NON_TEXT_MODEL_PATTERNS`

Three student profiles drive response generation:
- `'good'` (优秀学生) — Confident, structured, optimal path
- `'medium'` (需要引导的学生) — Basic understanding, 2-3 round guided process
- `'bad'` (答非所问的学生) — Comprehension gaps, boundary testing

### Storage Layer

Custom storage abstraction (`packages/storage/lib/base/`) with Chrome storage API + live sync:

```typescript
const storage = createStorage<DataType>('key', defaultValue, {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});
// React: useSyncExternalStore pattern via getSnapshot() + subscribe()
```

**Important**: All storage modules must be exported in `packages/storage/lib/impl/index.ts`.

Key storage modules:
- **`agent-session-storage`** — Session state (trainTaskId, sessionId, stepId)
- **`agent-chat-storage`** — Chat message history
- **`llm-config-storage`** — LLM config: API credentials, model, temperature, student profiles, system prompt, dialogue simulation content, knowledge base. Default model: `Doubao-1.5-pro-32k`, temp `0.7`, max history rounds `5`
- **`agent-log-storage`** — Per-session conversation logging. Sessions created with unique IDs (`log_{timestamp}_{random}`), each tracking entries with stepId, round number, source, user/AI text

### Dialogue Simulation & Knowledge Base

Managed via `SimulationConfigModal.tsx`:
- **Dialogue simulation**: Accepts historical logs in `AI: / 用户:` format, or auto-generates from training scripts using LLM with profile selection
- **Knowledge base**: Free-form reference materials for the AI student role
- Both features have independent enable/disable toggles
- Config persisted in `llmConfigStorage`

## Development Notes

- **HMR freezes**: Restart dev server, or kill `turbo` process if grpc errors
- **Import paths**: Always use `@extension/` aliases (e.g., `@extension/storage`)
- **Background script**: Runs as service worker — no DOM access, use chrome APIs only
- **Environment variables**: Edit `packages/env/.env.defaults`, register in `packages/env/src/index.ts`, import from `@extension/env`
- **Tailwind**: Extend via `packages/tailwind-config`, don't duplicate configs
- **Chat UI styling**: Gradient backgrounds, asymmetric rounded corners (`rounded-br-md`), animations — keep consistent

### Polymas Integration

- **Auth Cookie**: `ai-poly` from `hike-teaching-center.polymas.com`
- **API Base**: `https://cloudapi.polymas.com`
- **Required URL Param**: `trainTaskId` (e.g., `?trainTaskId=g2dlgQ4JOYimgZnNXxkb`)

## ESLint 规则 (重要)

Pre-commit hook 会自动运行 ESLint，错误会阻止提交。**必须遵守：**

### 函数定义风格 (`func-style`)
```typescript
// ❌ function MyComponent() { ... }
// ✅ const MyComponent = () => { ... };
```

### 导出语句位置 (`import-x/exports-last`)
```typescript
// ❌ 不要在中间导出
export const foo = 1;
const bar = 2;

// ✅ 所有导出放在文件末尾
const foo = 1;
const bar = 2;
export { foo };
export type { SomeType };
```

### 无障碍访问 (`jsx-a11y/*`)
```tsx
// 可点击的非交互元素必须支持键盘操作
<div
  onClick={handleClick}
  onKeyDown={e => e.key === 'Enter' && handleClick()}
  role="button"
  tabIndex={0}
  aria-label="描述性标签"
/>

// 表单 label 必须关联控件
<label htmlFor="username">用户名</label>
<input id="username" type="text" />
```

### 未使用变量 (`@typescript-eslint/no-unused-vars`)
```typescript
// ❌ } catch (e) { ... }
// ✅ } catch { ... }
```

## Build Artifacts

- `dist/` — Built extension (gitignored)
- `dist-zip/` — Zipped for distribution
- `.turbo/` — Turborepo cache
