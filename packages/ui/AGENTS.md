# packages/ui KNOWLEDGE BASE

## OVERVIEW
Shared React UI component library for the extension.

## STRUCTURE
```
packages/ui/lib/
├── assets/       # Static assets like SVGs
├── components/   # React components (agent-chat, error-display, etc.)
├── utils.ts      # UI-specific utilities (e.g., `cn` for Tailwind class merging)
└── index.ts      # Package exports
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Chat UI | `lib/components/agent-chat/` | Reusable message bubbles, inputs, and step indicators |
| Error UI | `lib/components/error-display/` | Error boundaries and fallback views |

## CONVENTIONS
- UI components use standard Tailwind CSS classes and the `cn()` utility for merging.
- **ESM Imports**: Relative imports must include the `.js` extension (e.g., `import { cn } from '../../utils.js';`) to support proper module resolution in Vite/ESBuild output.
- React components use PascalCase, and hooks use camelCase.
- Maintain generic UI state; complex domain logic should be handled by the consuming page/feature.

## ANTI-PATTERNS (THIS PROJECT)
- **NO business logic**: Do not fetch data or directly communicate with the Chrome background script from within this shared UI package.
