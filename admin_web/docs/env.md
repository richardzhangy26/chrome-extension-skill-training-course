# Environment Variables

The project uses **T3 Env** (`@t3-oss/env-core`) for type-safe validation:

| Source | File | When | Prefix / source |
|--------|------|------|------------------|
| **clientEnv** | `src/env/client.ts` | Build time (Vite) | `VITE_*` from `import.meta.env` |
| **serverEnv** | `src/env/server.ts` | Runtime (Worker) | `process.env` (Wrangler vars/secrets) |

**Rule of thumb:** Use **clientEnv** for values inlined at build (public URLs, analytics IDs, feature keys). Use **serverEnv** for secrets and server-only config (API keys, webhook secrets). Deployment target is **Cloudflare Workers**.

---

## 1. Build-time (clientEnv)

Values are read by Vite from `.env*` during `pnpm dev` / `pnpm build` and inlined into the bundle. They are **not** available again at Worker runtime.

**Where to set:** Local → `.env.local`. Production → `.env.production` or CI/build environment variables. Only **`VITE_`**-prefixed variables are exposed to app code.

### Variables

| Variable | Purpose | Required | Notes |
|----------|---------|----------|--------|
| **Base** | | | |
| `VITE_BASE_URL` | Site origin (e.g. `getBaseUrl()`) | No | Default: `http://localhost:3000` |
| **Payment** | | | |
| `VITE_PAYMENT_PROVIDER` | Payment provider (`stripe`, `creem`, or `''`) | No | Default: `''` (payment disabled); set to `stripe` or `creem` to enable |
| **Payment (Stripe)** | | | |
| `VITE_STRIPE_PRICE_PRO_MONTHLY` | Stripe Price ID (Pro monthly) | No | Required for pricing/checkout when using Stripe |
| `VITE_STRIPE_PRICE_PRO_YEARLY` | Stripe Price ID (Pro yearly) | No | |
| `VITE_STRIPE_PRICE_LIFETIME` | Stripe Price ID (Lifetime) | No | |
| **Payment (Creem)** | | | |
| `VITE_CREEM_PRODUCT_PRO_MONTHLY` | Creem Product ID (Pro monthly) | No | Required for pricing/checkout when using Creem |
| `VITE_CREEM_PRODUCT_PRO_YEARLY` | Creem Product ID (Pro yearly) | No | |
| `VITE_CREEM_PRODUCT_LIFETIME` | Creem Product ID (Lifetime) | No | |
| **Analytics** | | | |
| `VITE_GOOGLE_ANALYTICS_ID` | Google Analytics | No | |
| `VITE_CLARITY_PROJECT_ID` | Microsoft Clarity | No | |
| `VITE_PLAUSIBLE_SCRIPT` | Plausible script URL | No | |
| `VITE_UMAMI_WEBSITE_ID` | Umami Analytics | No | |
| `VITE_UMAMI_SCRIPT` | Umami script URL | No | |
| **Chat & support** | | | |
| `VITE_CRISP_WEBSITE_ID` | Crisp chat | No | When set, `CrispChat` loads the Crisp SDK after browser idle time |

Do **not** put `VITE_*` in Wrangler `vars` or `wrangler secret`—they are build-time only.

---

## 2. Runtime (serverEnv)

Read at **Worker request time**. Used for secrets, API keys, and server-only config.

**Where to set:** Local → `.env.local` (loaded into `process.env` by the dev process). Cloudflare Workers → **`wrangler secret put <NAME>`** for secrets, or **`vars`** in `wrangler.jsonc` for non-sensitive values. With `nodejs_compat_populate_process_env` enabled, vars and secrets appear on `process.env`. D1/R2 and other **bindings** are accessed via `env.DB`, `env.FILES`, etc., not `process.env`.

### Variables

| Variable | Purpose | Required | Used by |
|----------|---------|----------|---------|
| **Base** | | | |
| `VITE_BASE_URL` | URL (schema validation at runtime) | No | Default: `http://localhost:3000`; same value as build |
| **Auth** | | | |
| `BETTER_AUTH_SECRET` | Better Auth session signing | Yes (prod) | Auth; default only for CLI; [Mail](./mail.md) for verification/reset |
| `GOOGLE_CLIENT_ID` | Google OAuth | No | Auth when Google login enabled |
| `GOOGLE_CLIENT_SECRET` | Google OAuth | No | Auth when Google login enabled |
| **Mail & newsletter (Resend)** | | | |
| `RESEND_API_KEY` | Resend API | No | [Mail](./mail.md), [Newsletter](./newsletter.md) (when using Resend) |
| **Mail (Cloudflare Email)** | | | |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID | No | [Mail](./mail.md); required when using Cloudflare provider |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token | No | [Mail](./mail.md); required when using Cloudflare provider |
| **Newsletter (Beehiiv)** | | | |
| `BEEHIIV_API_KEY` | Beehiiv API | No | Newsletter when provider is Beehiiv |
| `BEEHIIV_PUBLICATION_ID` | Beehiiv publication | No | Newsletter when provider is Beehiiv |
| **Notification** | | | |
| `DISCORD_WEBHOOK_URL` | Discord webhook | No | Notification (Discord) |
| `FEISHU_WEBHOOK_URL` | Feishu webhook | No | Notification (Feishu) |
| **Payment (Stripe)** | | | |
| `STRIPE_SECRET_KEY` | Stripe API key | No | [Payment](./payment.md); required when using Stripe |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing | No | Payment webhook (Stripe) |
| **Payment (Creem)** | | | |
| `CREEM_API_KEY` | Creem API key | No | [Payment](./payment.md); required when using Creem |
| `CREEM_WEBHOOK_SECRET` | Creem webhook signing | No | Payment webhook (Creem) |
| `CREEM_DEBUG` | Use Creem sandbox API | No | Set to `true` for test mode (`test-api.creem.io`) |
| **AI** | | | |
| `FAL_KEY` | fal.ai API key | No | [AI](../src/api/ai.ts); required for image generation/edit via fal.ai |

---

## 3. VITE_BASE_URL and getBaseUrl()

`getBaseUrl()` in `src/lib/urls.ts` reads **clientEnv.VITE_BASE_URL** (build-time).

- **Local:** Set in `.env.local` or omit to use default `http://localhost:3000`.
- **Production:** Set in the **build environment** (e.g. `.env.production` or CI). You do **not** set it in Worker runtime vars.

---

## 4. Files and config overview

| File / mechanism | When it applies | Notes |
|------------------|-----------------|--------|
| `.env.local` | Present during `pnpm dev` | Build + runtime locally; git-ignored |
| `.env.production` | During `pnpm build` | Production build (e.g. `VITE_BASE_URL`); do not commit secrets |
| `wrangler.jsonc` `vars` | Worker runtime | Non-sensitive config → `process.env` when nodejs compat is on |
| `wrangler secret put <NAME>` | Worker runtime | Secrets → `process.env` |

Copy **`.env.example`** to **`.env.local`** and fill in values. See module docs ([Auth](./auth.md), [Mail](./mail.md), [Payment](./payment.md), etc.) for which vars each feature needs.
