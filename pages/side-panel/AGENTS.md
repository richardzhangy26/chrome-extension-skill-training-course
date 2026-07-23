# pages/side-panel Agent Guide

## Overview
`pages/side-panel` is the main Chrome extension UI for Polymas training. It supports:
- Text training through Polymas REST APIs.
- Voice training through the Polymas `trainFlow` WebSocket plus local TTS/audio framing.
- LLM-driven AI student answers.
- Dialogue simulation and knowledge-base configuration shared across text and voice modes.
- Admin Web login/register and server-managed LLM configuration.

## Structure
```text
pages/side-panel/src/
├── components/        # UI views and modals
├── hooks/             # Conversation/auth state machines
├── services/
│   ├── audio/         # TTS synthesis and PCM/audio frame helpers
│   ├── timing/        # Throttle-safe sleep backed by a dedicated Worker
│   ├── ws/            # Polymas training-flow WebSocket client
│   ├── llm-service.ts
│   ├── background-bridge.ts
│   ├── admin-web-service.ts
│   └── polymas-user-service.ts
├── types/
└── SidePanel.tsx
```

## Where To Look
| Task | Location | Notes |
| --- | --- | --- |
| Text chat state | `src/hooks/useAgentChat.ts` | `IDLE -> FETCHING_STEPS -> RUNNING_CARD -> CHATTING -> COMPLETED` |
| Voice chat state | `src/hooks/useVoiceAgentChat.ts` | `IDLE -> CONNECTING -> CONNECTED -> SENDING_AUDIO -> WAITING_SERVER -> BOT_SPEAKING -> COMPLETED/ERROR` |
| Voice WS client | `src/services/ws/training-ws-client.ts` | Connects to `wss://cloudapi.polymas.com/ai-tools/ws/v2/trainFlow`; owns message handlers and heartbeat |
| TTS/audio pipeline | `src/services/audio/tts-client.ts`, `pcm-codec.ts`, `frame-builder.ts` | TTS is fetched directly, decoded to 16k PCM, then chunked for the WS channel |
| LLM requests | `src/services/llm-service.ts` | Payload building, model config, student answers, stage-by-stage simulation generation |
| Simulation UI | `src/components/SimulationConfigModal.tsx`, `SimulationConfigBar.tsx` | Shared text/voice controls for dialogue simulation and knowledge base |
| Settings UI | `src/components/SettingsModal.tsx`, `VoiceModeSettings.tsx` | LLM settings and voice/TTS settings |
| Admin Web auth | `src/hooks/useAdminWebAuth.ts`, `src/components/AuthPanel.tsx` | Login/register/session state and config pull-down |
| Admin Web requests | `src/services/admin-web-service.ts` | Calls Better Auth and extension config APIs over `ADMIN_WEB_REQUEST` |
| Background bridge | `src/services/background-bridge.ts` | Typed message bridge to the MV3 background service worker |
| Polymas user info | `src/services/polymas-user-service.ts` | Cached `{ userId, schoolId }`; invalidate on auth changes |

## Mode And Runtime Rules
- `ModeToggle.tsx` switches between text training and voice training; the mode is persisted in `llmConfigStorage.voiceModeEnabled`.
- Text and voice sessions must reset cleanly when switching modes.
- Voice mode sends generated or manually-entered student text through TTS, PCM conversion, and the WS audio frame sender.
- Voice-mode services talk directly to Polymas via `fetch`/`WebSocket`; do not route binary TTS audio through `apiRequest`, because that path JSON-parses responses.
- All voice-pipeline timing (frame pacing, heartbeat, response watchdog) must use `services/timing/throttle-safe-sleep.ts`, never bare `setTimeout`: Chrome throttles hidden-page main-thread timers to 1/s (1/min after 5 hidden minutes), which starves the 100ms frame cadence and makes the server-side ASR truncate user audio.
- Manual voice text input is TTS-sent as user audio. Simulation/knowledge-base content only affects AI auto-generation, matching text-mode behavior.

## Dialogue Simulation And Knowledge Base
- `llmConfigStorage` is the single source for:
  - `dialogueSimulationEnabled`
  - `dialogueSimulationContent`
  - `knowledgeBaseEnabled`
  - `knowledgeBaseContent`
  - `studentProfiles`
  - `studentProfileId`
- `SimulationConfigBar.tsx` is shared by text and voice modes. Do not fork separate simulation toggle UIs unless behavior truly diverges.
- Voice mode already consumes simulation/knowledge-base content through `generateStudentAnswer()` -> `buildStudentRoleSystemPrompt()`. Adding a new runtime branch is usually wrong.
- `generateSimulationDialogueStage` is intentionally stage-by-stage and reports progress. Do not replace it with one long LLM call; long one-shot prompts previously truncated.
- `SimulationConfigModal` must clean async generation state in `finally` so failures do not leave the UI stuck.

## Admin Web Login And Config Sync
- Admin Web auth is separate from Polymas auth.
- `admin-web-service.ts` handles `signUp`, `signIn`, `signOut`, `getSession`, `fetchLlmConfig`, and `pushLlmConfig`.
- Better Auth returns the bearer token in `set-auth-token`; store it through `authSessionStorage`.
- All authenticated Admin Web requests go through `background-bridge.adminWebRequest()` with `auth: true`.
- `useAdminWebAuth` owns session state and config synchronization:
  - startup checks an existing token with `getSession`;
  - login pulls the synced subset down and merges it onto local config;
  - `GET /api/extension/config` returning `config:null` means seed the server once from local `llmConfigStorage` (only the synced subset is pushed);
  - any 401 clears local auth session.
- Only these fields sync via Admin Web (see `SYNCED_LLM_CONFIG_KEYS` / `pickSyncedConfig` in `@extension/storage`):
  - `apiKey`, `apiUrl`, `model`
  - `systemPrompt`
  - `studentProfiles`
  - `dialogueSimulationContent`
  - `knowledgeBaseContent`
- All other `LLMConfig` fields (temperature, topK, maxTokens, maxHistoryRounds, serviceCode, enabled toggles, `systemPromptMode`, `studentProfileId`, `voiceModeEnabled`, all TTS fields) are local-only. Editing them logged-in must not push to Admin Web.
- When logged in, `SettingsModal` / `SimulationConfigModal` / `SimulationConfigBar` lock only the synced-field inputs (per-field `disabled`); everything else stays editable and saves back to `llmConfigStorage`.
- Users edit synced fields at `/settings/extension`; the banner in the extension modals should point them there.
- When logged out, all fields remain locally editable as before.

## Conventions
- Keep presentation in React components and stateful workflow logic in hooks.
- Use `background-bridge.ts` instead of direct `chrome.runtime.sendMessage` in feature code.
- Use `@extension/storage` and `@extension/ui`; do not import across workspace packages with deep relative paths.
- Shared UI belongs in `@extension/ui`. Do not create generic buttons/loaders in side-panel unless they are truly local to this page.
- Keep exports at the end of files to satisfy root ESLint.
- Use arrow functions rather than function declarations in extension TypeScript/TSX.

## Anti-Patterns
- Do not call `chrome.*` directly from side-panel code if a bridge/storage wrapper exists.
- Do not mix Admin Web bearer tokens into Polymas `API_REQUEST` calls.
- Do not mix Polymas `ai-poly` cookie auth into Admin Web requests.
- Do not add duplicate simulation/knowledge-base state outside `llmConfigStorage`.
- Do not lock non-synced fields (temperature, TTS, toggles, mode selectors, etc.) when logged in; only the fields in `SYNCED_LLM_CONFIG_KEYS` should be read-only.
- Do not push non-synced fields to Admin Web from `useAdminWebAuth` / `admin-web-service`; always pipe writes through `pickSyncedConfig`.
