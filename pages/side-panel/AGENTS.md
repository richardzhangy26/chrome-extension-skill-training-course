# pages/side-panel KNOWLEDGE BASE

## OVERVIEW
Primary UI surface (Chrome Side Panel) acting as the main LLM interaction chat interface for the Polymas training assistant. Supports two interaction modes, toggled via `ModeToggle.tsx`: text chat (`useAgentChat`) and voice/口语训练 (`useVoiceAgentChat`).

## STRUCTURE
```
pages/side-panel/src/
├── components/        # UI views and Modals (Settings, History, Debug, VoiceModeSettings, ModeToggle, etc.)
├── hooks/              # Complex state management and logic (useAgentChat, useVoiceAgentChat, useMultiRoleRun)
├── services/
│   ├── audio/          # TTS synthesis + PCM encoding for voice mode (tts-client, pcm-codec, frame-builder)
│   ├── ws/              # WebSocket client for the Polymas training-flow channel (training-ws-client)
│   ├── llm-service.ts   # LLM prompt formatting, student-answer generation, staged dialogue simulation
│   ├── background-bridge.ts     # Side panel <-> background script messaging
│   └── polymas-user-service.ts  # Cached fetch of current Polymas user/school id
└── SidePanel.tsx       # Main application entry view
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Chat Core Logic | `src/hooks/useAgentChat.ts` | Text-mode state machine managing the AI agent conversation |
| Voice Chat Logic | `src/hooks/useVoiceAgentChat.ts` | Voice-mode state machine: `IDLE → CONNECTING → CONNECTED → SENDING_AUDIO → WAITING_SERVER → BOT_SPEAKING → COMPLETED/ERROR`. Drives the WS client + TTS pipeline and reuses the `ChatMessage` shape from `useAgentChat` so `MessageBubble`/`MessageList` stay shared. |
| Multi-Role Logic| `src/hooks/useMultiRoleRun.ts`| State management for simulating multiple roles/personas |
| Training WS Client | `src/services/ws/training-ws-client.ts` | Connects to `wss://cloudapi.polymas.com/ai-tools/ws/v2/trainFlow`; mirrors `auto_audio_train.py`'s `TrainingClient` (connect/listen_loop/send_json) with a heartbeat and event-handler callbacks (`onBotAnswer`, `onStepEnd`, `onTaskEnd`, ...) |
| TTS / Audio Pipeline | `src/services/audio/tts-client.ts`, `pcm-codec.ts`, `frame-builder.ts` | `synthesizeTTS()` fetches raw or SSE-framed audio directly (not via `apiRequest`, to avoid JSON-mangling binary data); `mp3ToPcm16k()` decodes to 16k PCM; `buildAudioFrames()`/`buildSilenceFrame()` chunk it for the WS channel |
| Polymas User Info | `src/services/polymas-user-service.ts` | `fetchPolymasUserInfo()` caches `{userId, schoolId}` in-memory; call `invalidatePolymasUserInfo()` on auth changes |
| LLM Requests | `src/services/llm-service.ts` | Configuration and formatting of LLM API prompts. Dialogue simulation is generated **stage-by-stage** (`generateSimulationDialogueStage`), not in one shot, to avoid single-call token-limit truncation; reports progress via an `onProgress` callback and retries once in a leaner mode on a detected `finishReason` truncation |
| Settings | `src/components/SettingsModal.tsx`, `VoiceModeSettings.tsx` | Configuring prompts, endpoints, student personas, and voice-mode-specific options (TTS model/voice/speed/format) |
| Dialogue Simulation UI | `src/components/SimulationConfigModal.tsx` | Drives staged generation, surfaces per-stage progress, and cleans up generation state via try/finally on error |

## CONVENTIONS
- Separates presentation (React components) from logic (Hooks) strictly.
- Communicates with the background worker via `background-bridge.ts`.
- Subscribes to shared Chrome storage via `@extension/storage` hooks to read API Keys and configurations.
- Voice-mode services talk to Polymas directly (`fetch`/`WebSocket`) rather than through `background-bridge`'s `apiRequest`, since that path JSON-parses responses and would corrupt binary audio.

## ANTI-PATTERNS (THIS PROJECT)
- **NO generic components**: Do not build generic buttons or loaders here; import them from `@extension/ui`.
- **NO Chrome API direct usage**: Avoid using `chrome.*` directly if a wrapper exists in `@extension/shared` or `@extension/storage`.
