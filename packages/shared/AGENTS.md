# packages/shared Agent Guide

## Overview
`packages/shared` contains generic extension utilities, types, hooks, and higher-order wrappers used by multiple extension workspaces. Keep this package broadly reusable and free of page-specific business logic.

## Structure
```text
packages/shared/lib/
├── agent/    # Agent domain models, state machine, and API client types
├── hoc/      # Error boundary and suspense wrappers
├── hooks/    # Shared React hooks
└── utils/    # General utilities and extension app initialization helpers
```

## Where To Look
| Task | Location | Notes |
| --- | --- | --- |
| Agent models/state | `lib/agent/` | Shared conversation/domain primitives |
| Storage hook helpers | `lib/hooks/use-storage.tsx` | Reactive wrapper for extension storage use cases |
| App initialization | `lib/utils/init-app-with-shadow.ts` | Shadow DOM initialization for content surfaces |
| HOCs | `lib/hoc/` | Standard wrappers for extension entry points |

## Conventions
- Keep code generic. Anything tied to side-panel flows, Admin Web auth, Polymas endpoints, or a specific page belongs elsewhere.
- Relative ESM imports must include the `.js` extension.
- React-specific code is allowed only in `hooks` and `hoc`.
- Prefer small pure utilities and typed domain helpers.
- Export public APIs from package entrypoints consistently with nearby files.

## Anti-Patterns
- Do not implement visual UI elements here; use `packages/ui`.
- Do not call `chrome.*` directly if a wrapper exists in `@extension/storage` or page services.
- Do not import side-panel services, background bridge code, Admin Web services, or page-specific components.
- Do not add synchronization or auth-session ownership logic here; that belongs in `packages/storage` or feature hooks.
