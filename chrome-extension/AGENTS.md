# chrome-extension Agent Guide

## Overview
`chrome-extension/` owns the MV3 extension shell: manifest source, background service worker, public assets, and generated extension metadata.

## Structure
```text
chrome-extension/
├── manifest.ts
├── public/
└── src/background/index.ts
```

## Manifest Rules
- Edit `manifest.ts`, not generated `manifest.json`.
- Keep required host permissions for:
  - Polymas training APIs and teaching center pages.
  - Admin Web dev/prod domains when extension login/config sync is in scope.
- Background service worker entry remains `background.js` with `type: 'module'`.
- Do not manually delete extension pages from the manifest. Use the module manager from the root workspace when removing generated UI surfaces.

## Background Service Worker
`src/background/index.ts` handles:
- `GET_CURRENT_TAB_URL`
- `GET_AUTH`
- `EXTRACT_TRAIN_TASK_ID`
- `API_REQUEST`
- `ADMIN_WEB_REQUEST`

### Polymas `API_REQUEST`
- Uses `ai-poly` cookie information from `hike-teaching-center.polymas.com`.
- Targets `https://cloudapi.polymas.com` unless a full endpoint URL is provided.
- Retries retryable 5xx responses.
- This path is for Polymas training APIs only.

### Admin Web `ADMIN_WEB_REQUEST`
- Uses the bearer token stored in `authSessionStorage`.
- Does not inject the Polymas cookie or `ai-poly` authorization.
- Targets the configured Admin Web base URL.
- Handles Better Auth login/register/session and extension config calls.
- If future history sync adds `DELETE`, update method unions in both `chrome-extension/src/background/index.ts` and `pages/side-panel/src/services/background-bridge.ts` together.

## Constraints
- MV3 background service workers have no DOM access.
- Use `chrome.*` APIs only in background or other extension contexts where they are available.
- Keep message payload/response types synchronized with `pages/side-panel/src/services/background-bridge.ts`.
- Binary audio/TTS responses should not go through the JSON API proxy path.

## Anti-Patterns
- Do not put side-panel React logic here.
- Do not mix Admin Web bearer auth into Polymas API requests.
- Do not mix Polymas cookie auth into Admin Web requests.
- Do not hard-code production-only assumptions without keeping local dev usable.
