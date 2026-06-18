# AI module

End-to-end AI playground showcasing how to integrate **Cloudflare Workers AI** and **fal.ai** in a TanStack Start + Cloudflare Workers app. All demos run as TanStack server functions (`createServerFn`) calling either the plain Workers AI REST API or the `@tanstack/ai` + `@tanstack/ai-fal` adapter, with simple React cards as the UI.

The whole playground lives at **`/ai`** page and is reachable from the navbar **AI** dropdown menus. Each demo is a self-contained card so you can copy any single piece into your own project.

---

## Directory structure

```
src/api/
└── ai.ts                       # 7 server functions + helpers (runWorkersAi, parseTaglines, base64 utils)

src/config/
└── ai-models.ts                # Central model IDs shared by server functions and UI cards

src/routes/(pages)/
└── ai.tsx                      # Page that mounts each card inside <section id="..."> for hash-anchor nav

src/components/ai/
├── ai-summarization-card.tsx   # Text summarization (Llama 3.2 chat)
├── ai-translation-card.tsx     # Translation (m2m100, 10 languages)
├── ai-tagline-card.tsx         # Tagline generator (Llama 3.2 chat)
├── ai-tts-card.tsx             # Text-to-speech (Deepgram Aura, 12 voices)
├── ai-caption-card.tsx         # Image-to-text captioning (LLaVA)
├── ai-cf-image-card.tsx        # Text-to-image · Workers AI (Flux / SDXL / DreamShaper)
├── ai-image-card.tsx           # Text-to-image · fal.ai (Gemini / Flux / GPT Image 2)
└── ai-image-edit-card.tsx      # Image-to-image · fal.ai Gemini edit (Avatar Stylizer)
```

---

## Configuration

| Source | Key | Description |
|--------|-----|-------------|
| Env var | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID — used for all Workers AI REST calls. |
| Env var | `CLOUDFLARE_API_TOKEN` | Cloudflare API token with **Workers AI: Read** permission. Used for summarization, translation, tagline, TTS, captioning, CF image gen. |
| Env var | `FAL_KEY` | fal.ai API key. Used for text-to-image (Gemini / Flux / GPT Image 2) and image-to-image (Gemini edit). |

All three are read in `src/env/server.ts` (Zod-validated via `@t3-oss/env-core`) and accessed inside server functions through `serverEnv`.

> The `@cf/...` Workers AI binding from `wrangler.jsonc` is **not** used here — every Workers AI call goes through the public REST endpoint so the same code works in CI / external runtimes too. Set the secrets with `wrangler secret put CLOUDFLARE_ACCOUNT_ID` (etc.) in production.

---

## Architecture

Every demo follows the same shape:

```
Browser (card) ──▶ TanStack server function ──▶ provider API ──▶ response
                  (createServerFn + Zod)         (Workers AI REST | fal adapter)
```

- **Validation** — every server function uses `.inputValidator(zodSchema)` for both type safety and runtime validation (max prompt length, file size cap, language enum, model enum, …).
- **Model IDs** — runtime model IDs are centralized in `src/config/ai-models.ts` and imported by both server functions and UI cards.
- **Workers AI helper** — `runWorkersAi<TResult>(model, body)` in `src/api/ai.ts` wraps the common JSON request flow (auth headers, `success` / `errors` envelope) so each demo only declares its model + payload.
- **Binary responses** — TTS (`audio/mpeg`) and CF image gen (binary `image/*`) bypass `runWorkersAi` and base64-encode the body via `arrayBufferToBase64()` so the result can be returned as a `data:` URL the browser renders directly.
- **Image bytes in / out** — captioning and image-edit accept the user's upload as a base64 string, decoded server-side via `base64ToBytes()` (LLaVA wants `Array.from(uint8)`) or forwarded as a `data:` URI (fal accepts data URIs natively).
- **Client downloads** — image cards use `downloadFile()` from `src/lib/download.ts`, which fetches the image into a blob (handles CORS for fal CDN URLs) before clicking a hidden `<a download>` link, so the browser actually saves the file instead of navigating.

---

## Server functions (`src/api/ai.ts`)

| Export | Provider · Model | Input | Output |
|--------|------------------|-------|--------|
| **summarizeText** | Workers AI · `@cf/meta/llama-3.2-3b-instruct` (chat) | `text` (50–500 chars) | `{ summary }` |
| **translateText** | Workers AI · `@cf/meta/m2m100-1.2b` | `text`, `sourceLang`, `targetLang` (10-language enum) | `{ translatedText }` |
| **generateTaglines** | Workers AI · `@cf/meta/llama-3.2-3b-instruct` (chat) | `product` description | `{ taglines: string[] }` (parsed numbered list) |
| **synthesizeSpeech** | Workers AI · `@cf/deepgram/aura-1` | `text`, `speaker` (12 voices) | `{ audioUrl, bytes }` (`data:audio/mpeg;base64,...`) |
| **captionImage** | Workers AI · `@cf/llava-hf/llava-1.5-7b-hf` | `imageBase64`, `prompt` | `{ description }` |
| **generateCfImage** | Workers AI · Flux.1 Schnell / SDXL Lightning / DreamShaper 8 LCM | `prompt`, `model` (enum) | `{ imageUrl, model }` (`data:image/...;base64,...`) |
| **generateAiImage** | fal.ai · Nano Banana / Flux Schnell / GPT Image 2 | `prompt`, `model` (enum) | `{ imageUrl, model }` (fal CDN URL) |
| **editAiImage** | fal.ai · `fal-ai/nano-banana/edit` | `imageBase64`, `prompt` | `{ imageUrl }` |

All functions throw a descriptive `Error` on missing env, non-2xx responses, or empty payloads — the cards surface the message in the result panel.

---

## The demos

The page renders one section per demo, each wrapped in `<section id="...">` so the AI navbar dropdown can deep-link with hash anchors (e.g. `/ai#tagline-generator`).

### 1. Text Summarization
**Card:** `AiSummarizationCard` · **Model:** `@cf/meta/llama-3.2-3b-instruct` (Workers AI)

Paste a long article (50–500 chars), get a concise summary back. Demonstrates a single-shot chat call with `messages: [{ role, content }]` and a system prompt that constrains the response to summary text only.

### 2. Translation
**Card:** `AiTranslationCard` · **Model:** `@cf/meta/m2m100-1.2b` (Workers AI)

Many-to-many multilingual translation across 10 languages with a swap button. Shows how to declare a `z.enum(...)` schema for both source and target language and a `.refine()` rule preventing same-language translation.

### 3. Tagline Generator (Chat)
**Card:** `AiTaglineCard` · **Model:** `@cf/meta/llama-3.2-3b-instruct` (Workers AI)

Single-shot chat call with a system prompt that constrains output to a numbered list of 5 taglines. Shows how to call instruct chat models with `messages: [{ role, content }]` and parse semi-structured text back into JSON via `parseTaglines()`.

### 4. Text to Speech
**Card:** `AiTtsCard` · **Model:** `@cf/deepgram/aura-1` (Workers AI)

12 selectable voices (Asteria, Luna, Stella, Athena, Hera, Angus, Arcas, Orion, Orpheus, Perseus, Helios, Zeus). Returns binary MP3 (`Content-Type: audio/mpeg`) which is base64-encoded server-side and served as a `data:audio/mpeg;base64,...` URL into a native `<audio controls>`. Includes a per-character cost preview ($0.015 / 1K chars).

### 5. Image Captioning
**Card:** `AiCaptionCard` · **Model:** `@cf/llava-hf/llava-1.5-7b-hf` (Workers AI)

Upload a portrait or photo (≤1 MB), pick a prompt preset (caption / detailed description / 5 keywords / objects list) or write your own, and get a description back. The image is decoded with `base64ToBytes()` and sent to LLaVA as `image: Array.from(bytes)` per the model's input schema.

### 6. Image Generator · Workers AI
**Card:** `AiCfImageCard` · **Models:**
- `@cf/black-forest-labs/flux-1-schnell` (default, JSON `{ image: base64 }`)
- `@cf/bytedance/stable-diffusion-xl-lightning` (Beta, binary `image/png` body)
- `@cf/lykon/dreamshaper-8-lcm` (photorealistic SD fine-tune)

Demonstrates Workers AI's two response shapes (JSON envelope vs. raw binary). The server function branches on `Content-Type`, base64-encodes the bytes when needed, and always returns a `data:image/...;base64,...` URL the browser can render or download.

### 7. Image Generator · fal.ai
**Card:** `AiImageCard` · **Models:**
- `fal-ai/nano-banana` (default — Google "Nano Banana", ~$0.039 / image)
- `fal-ai/flux/schnell` (fast & cheap — ~$0.003 / image)
- `openai/gpt-image-2` (premium — sharp text & photoreal; forced to `quality: 'low'` + `output_format: 'jpeg'` so it finishes in ~30 s within Cloudflare's subrequest budget)

Uses the `@tanstack/ai` + `@tanstack/ai-fal` adapter via `falImage(model, { apiKey })` and `generateImage({ adapter, prompt })`. The adapter polls fal's queue under the hood. Returns the fal-hosted CDN URL.

### 8. Avatar Stylizer (image-to-image)
**Card:** `AiImageEditCard` · **Model:** `fal-ai/nano-banana/edit` (fal.ai)

Upload a portrait, pick a style preset (Bobblehead Caricature / Pixar 3D / Anime Portrait) or write a custom prompt, get an identity-preserving stylized version back. Implementation passes the user image as a base64 `data:` URI inside `modelOptions.image_urls` — fal accepts data URIs natively, so no separate upload step is required.

Each preset prompt explicitly tells the model to *keep the original facial features recognizable* so the stylization survives the round-trip.

---

## Adding a new demo

1. **Server function** — add to `src/api/ai.ts`:
   - Declare a Zod schema for the input.
   - For Workers AI JSON models: call `runWorkersAi<TResult>(model, body)`.
   - For Workers AI binary endpoints: `fetch()` directly and base64-encode the buffer.
   - For fal.ai: `falImage(model, { apiKey: serverEnv.FAL_KEY })` + `generateImage({ adapter, prompt, modelOptions })`.
2. **Card** — create `src/components/ai/ai-<name>-card.tsx` matching the existing layout (`Card` → header with title + `<code>` model id + description, `CardContent` with two-column grid). Reuse `downloadFile()` for any image / audio result.
3. **Mount** — add `<section id="...">` to `src/routes/(pages)/ai.tsx`.
4. **Navbar** — add a `Routes.Ai<Name>` entry in `src/lib/routes.ts`, add flat `nav_ai_<name>_*` keys in both locale JSON files, then push a sub-item to the AI dropdown in `src/config/navbar-config.ts` with an icon.

---

## Dependencies

- **`@tanstack/ai`**, **`@tanstack/ai-fal`** — image generation adapter for fal.ai (used by `generateAiImage` and `editAiImage`).
- **`@fal-ai/client`** — transitive dependency of `@tanstack/ai-fal`; queues + polls fal jobs.

No Cloudflare AI binding is required (`AI` was removed from `wrangler.jsonc`) — every Workers AI call uses the REST API.
