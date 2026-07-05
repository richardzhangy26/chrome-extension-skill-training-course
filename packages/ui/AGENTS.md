# packages/ui Agent Guide

## Overview
`packages/ui` is the shared React UI component library for extension surfaces. It should provide reusable presentation primitives without owning Chrome APIs, background messaging, Polymas calls, Admin Web auth, or storage synchronization policy.

## Structure
```text
packages/ui/lib/
├── assets/       # Static assets such as SVGs
├── components/   # Reusable React components
├── utils.ts      # UI helpers such as cn()
└── index.ts      # Package exports
```

## Where To Look
| Task | Location | Notes |
| --- | --- | --- |
| Chat UI | `lib/components/agent-chat/` | Reusable message bubbles, inputs, and step indicators |
| Error UI | `lib/components/error-display/` | Error boundaries and fallback views |
| Utility classes | `lib/utils.ts` | Tailwind class merging helpers |

## Conventions
- Components use PascalCase.
- Hooks use camelCase with a `use` prefix.
- Use Tailwind classes and `cn()` for class composition.
- Relative ESM imports must include the `.js` extension.
- Keep props explicit and behavior presentational. Domain state machines should live in consuming pages/hooks.
- Export reusable components through package entrypoints when they are meant for cross-workspace use.

## Anti-Patterns
- Do not fetch data here.
- Do not call `chrome.*` here.
- Do not communicate with the background service worker here.
- Do not import `@extension/storage` for business behavior unless the component is explicitly a storage-aware shared UI pattern.
- Do not place Admin Web login/config logic or Polymas training logic in this package.
