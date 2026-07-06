# packages/storage Agent Guide

## Overview
`packages/storage` is the typed Chrome storage layer for the extension. It owns persistence primitives and shared storage modules; feature workflows should consume these modules rather than touching `chrome.storage` directly.

## Structure
```text
packages/storage/lib/
├── base/          # createStorage, StorageEnum, BaseStorageType
└── impl/          # concrete storage modules
```

## Storage Wrapper
Use `createStorage` for new storage modules.

```typescript
const storage = createStorage<DataType>('key', defaultValue, {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});
```

- `liveUpdate: true` enables subscription-based UI updates.
- React consumers generally use `getSnapshot()` and `subscribe()`.
- Storage modules may wrap base storage with domain helpers such as `setConfig()` or `clear()`.

## Modules
| Module | Purpose |
| --- | --- |
| `agent-session-storage.ts` | Current training task/session/step ids |
| `agent-chat-storage.ts` | Current conversation buffer |
| `agent-log-storage.ts` | Persisted conversation logs used by history |
| `llm-config-storage.ts` | LLM, student profile, simulation, knowledge-base, voice, and TTS config |
| `auth-session-storage.ts` | Admin Web bearer token and logged-in user identity |

## Contract Rules
- Every storage module in `lib/impl/` must be exported from `lib/impl/index.ts`.
- Keep relative ESM imports with `.js` extensions.
- Keep exports at the end of files to satisfy root ESLint.
- `llm-config-storage.ts` is the source contract for Admin Web's mirrored `LLMConfig` schema. Any field change must be reflected in `admin_web/src/lib/llm-config-schema.ts` and the Admin Web settings form/API as needed.
- `auth-session-storage.ts` stores only Admin Web auth state. Do not use it for Polymas `ai-poly` cookie auth.
- `agent-log-storage.ts` is the persisted history source. Future history cloud sync should use this module, not `agent-chat-storage`.

## Admin Web Sync Notes
- Logged-in config sync is one-way from Admin Web to extension after the first-login seed.
- A 401 from Admin Web should clear `auth-session-storage`.
- Config UI read-only behavior is controlled in side-panel components/hooks, not inside storage.
- For planned history sync v2, add ownership metadata and selectors in storage only when implementing that feature; do not preemptively change session shape for docs-only tasks.

## Anti-Patterns
- Do not call Admin Web or Polymas APIs from storage modules.
- Do not import side-panel hooks/services here.
- Do not add UI-specific formatting here.
- Do not create a second source of truth for LLM config outside `llm-config-storage`.
