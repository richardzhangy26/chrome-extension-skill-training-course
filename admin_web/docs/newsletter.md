# Newsletter module

Email subscribe / unsubscribe / status, driven by **Resend** or **Beehiiv**. Config via `websiteConfig.newsletter`; env from **serverEnv** (`src/env/server.ts`). See [Env](./env.md) for variable list and where to set them.

**Consumers:** API routes (`/api/newsletter/subscribe`, `unsubscribe`, `status`), hooks (`use-newsletter`), settings card (`NewsletterFormCard`), marketing block (`NewsletterCard`). Optional welcome email after subscribe is sent by the **Mail** module when `websiteConfig.mail.fromEmail` is set.

---

## Directory structure

**Core module** (`src/newsletter/`):

```
src/newsletter/
├── index.ts           # subscribe, unsubscribe, isSubscribed, getNewsletterProvider; providerRegistry
├── types.ts           # NewsletterProviderName, NewsletterProvider, params & handler types
└── provider/
    ├── resend.ts      # ResendNewsletterProvider (Resend Audiences contacts)
    └── beehiiv.ts     # BeehiivNewsletterProvider (@beehiiv/sdk)
```

**Server functions** (`src/api/newsletter.ts`): TanStack Start `createServerFn` — `getNewsletterStatus`, `subscribeNewsletter`, `unsubscribeNewsletter`. These are called by the client directly (no separate REST routes under `routes/api/newsletter/`).

**Client** (outside `src/newsletter/`):
- `src/hooks/use-newsletter.ts` — `useNewsletterStatus`, `useSubscribeNewsletter`, `useUnsubscribeNewsletter`, `newsletterKeys` (calls server functions from `@/api/newsletter`)
- `src/components/settings/notification/newsletter-form-card.tsx` — logged-in user toggle (Switch) in Settings → Notifications
- `src/components/blocks/newsletter-card.tsx` — public email form (e.g. homepage, waitlist)

---

## Configuration

| Source | Key | Description |
|--------|-----|-------------|
| `websiteConfig.newsletter` | `enable` | Master switch; when false, API returns 400 and UI hides. |
| | `provider` | `'resend'` \| `'beehiiv'`. |
| | `autoSubscribeAfterSignUp` | If true, call `subscribe(user.email)` after sign-up (implement in auth/sign-up flow). |
| `serverEnv` (`src/env/server.ts`) | `RESEND_API_KEY` | Optional; required when provider is `resend` (shared with Mail if used). |
| | `BEEHIIV_API_KEY`, `BEEHIIV_PUBLICATION_ID` | Optional; both required when provider is `beehiiv`. |

Env is defined in `serverEnv` (runtime: `process.env`; Worker vars/secrets populate it).

---

## Core API

| Export | Description |
|--------|-------------|
| **subscribe(email)** | Subscribe email; returns `Promise<boolean>`. |
| **unsubscribe(email)** | Unsubscribe; returns `Promise<boolean>`. |
| **isSubscribed(email)** | Check status; returns `Promise<boolean>`. |
| **getNewsletterProvider()** | Builds provider from config + env (no caching; new instance per call). |

---

## Provider interface

`NewsletterProvider` (`types.ts`) implements:

- `subscribe({ email })` → `Promise<boolean>`
- `unsubscribe({ email })` → `Promise<boolean>`
- `checkSubscribeStatus({ email })` → `Promise<boolean>`
- `getProviderName()` → string

**Resend:** Uses Resend Audiences contacts (`contacts.create` / `contacts.update` / `contacts.get`). Subscribe: create contact with `unsubscribed: false`; on conflict, update to subscribed.

**Beehiiv:** Uses `@beehiiv/sdk` (subscriptions + bulk updates). Subscribe: get by email, reactivate if needed or create; unsubscribe: patch subscription to unsubscribed.

**Adding a provider:** Extend `NewsletterProviderName` in `types.ts`, add provider-specific optional vars to `serverEnv` in `src/env/server.ts`, implement `NewsletterProvider` in `provider/<name>.ts`, and register a factory in `providerRegistry` in `index.ts`.

---

## Server functions (API surface)

Newsletter is exposed as **TanStack Start server functions** in `src/api/newsletter.ts`, not as REST routes. The client calls them via the generated RPC layer.

| Server function | Input | Behavior |
|-----------------|--------|----------|
| `getNewsletterStatus` | `{ email }` | Calls `isSubscribed(email)`; returns `{ subscribed }`. |
| `subscribeNewsletter` | `{ email }` | Validates email → `subscribe(email)` → optional welcome email (Mail module when `mail.fromEmail` set). |
| `unsubscribeNewsletter` | `{ email }` | Validates email → `unsubscribe(email)`. |

All return 400 when newsletter is disabled or email invalid; throw or return errors on provider/network failures. The hooks in `use-newsletter.ts` invoke these server functions.

---

## UI and hooks

- **use-newsletter** — `useNewsletterStatus(email)` (query), `useSubscribeNewsletter()` / `useUnsubscribeNewsletter()` (mutations). Calls API with `getBaseUrl()` for correct origin. Invalidates status query on subscribe/unsubscribe success.
- **NewsletterFormCard** — Renders only when `newsletter.enable` and user is logged in. Shows Switch bound to subscription status; toggling calls subscribe/unsubscribe and toast.
- **NewsletterCard** — Renders only when `newsletter.enable`. Email input + submit; calls `subscribeNewsletter` server function. Uses flat Paraglide `m.newsletter_*()` message functions.

---

## Dependencies

- **resend** — Resend SDK (audiences/contacts).
- **@beehiiv/sdk** — Beehiiv API client (when using Beehiiv provider).
