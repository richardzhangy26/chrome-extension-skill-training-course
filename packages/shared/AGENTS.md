# packages/shared KNOWLEDGE BASE

## OVERVIEW
Core shared utilities, HOCs, custom hooks, and agent domain models used across the entire monorepo.

## STRUCTURE
```
packages/shared/lib/
├── agent/    # Agent domain models, state machine, and API client types
├── hoc/      # Higher-order components (Error Boundary, Suspense)
├── hooks/    # Shared React hooks (e.g., use-storage)
└── utils/    # General utilities, logging, and DOM shadow root initialization
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Agent Logic | `lib/agent/state-machine.ts` | Core state transition models for conversations |
| Storage Sync | `lib/hooks/use-storage.tsx` | Helper to read/write Chrome local/sync storage reactively |
| App Init | `lib/utils/init-app-with-shadow.ts`| Shadow DOM initialization for content scripts |
| HOCs | `lib/hoc/` | Standard wrappers for extension entry points (`with-error-boundary`) |

## CONVENTIONS
- Keep code entirely generic and framework-agnostic where possible, except for the `hooks` and `hoc` folders which are React-specific.
- **ESM Imports**: Must use the `.js` extension for all relative path imports.

## ANTI-PATTERNS (THIS PROJECT)
- **NO UI components**: Do not implement visual UI elements here. Move them to `packages/ui`.
- **NO Page logic**: Business logic bound to a specific page or popup belongs in that `pages/` workspace.
