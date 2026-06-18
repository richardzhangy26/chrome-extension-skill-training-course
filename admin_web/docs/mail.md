# Mail module

Transactional email (verification, password reset, contact form, subscription welcome). **Resend** and **Cloudflare Email Service** are the built-in providers. Design allows adding other providers via a provider registry without changing callers.

**Consumers:** Auth (`sendVerificationEmail`, `sendResetPassword`), contact form (`sendContactMessage` in `src/api/contact.ts`), newsletter subscribe — all use `sendEmail(...)` only.

---

## Directory structure

```
src/mail/
├── index.ts           # sendEmail, getMailProvider, getTemplate; providerRegistry
├── types.ts           # EmailTemplate, MailProviderName, Send*Params, MailProvider
├── render.ts          # getTemplate, renderEmailHtml, toPlainText; subjectByTemplate
├── provider/
│   ├── resend.ts      # ResendProvider implements MailProvider
│   └── cloudflare.ts  # CloudflareProvider implements MailProvider
├── templates/
│   ├── verify-email.tsx
│   ├── forgot-password.tsx
│   ├── subscribe-newsletter.tsx
│   └── contact-message.tsx
└── components/
    ├── email-layout.tsx
    └── email-button.tsx
```

---

## Configuration

| Source | Key | Description |
|--------|-----|-------------|
| `websiteConfig.mail` | `provider` | `'resend'` or `'cloudflare'`. Extend in `src/types/index.d.ts` when adding providers. |
| | `fromEmail` | Sender address (required for sending). |
| | `supportEmail` | Used by contact form target. |
| Env var | `RESEND_API_KEY` | Required when using the Resend provider. |
| Env var | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID; required when using Cloudflare Email provider. |
| Env var | `CLOUDFLARE_API_TOKEN` | Cloudflare API token; required when using Cloudflare provider. |

---

## Providers

### Resend

Uses the [Resend](https://resend.com/docs) SDK. Requires `RESEND_API_KEY` env var.

```ts
// src/config/website.ts
mail: {
  enable: true,
  provider: 'resend',
  fromEmail: 'MyApp <support@example.com>',
}
```

### Cloudflare Email Service

Uses the [Cloudflare Email Service REST API](https://developers.cloudflare.com/email-service/api/send-emails/rest-api/). Works in any Node.js environment (Workers, CI/CD, scheduled scripts) — no Workers binding required.

**Prerequisites:**
1. Your domain must be using Cloudflare DNS.
2. Onboard your domain in the Cloudflare dashboard under **Email Sending**.
3. Create an API token with `com.cloudflare.api.token.Email.Send` permission in the Cloudflare dashboard.

**Environment variables:**

```bash
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token
```

**Usage:**

```ts
// src/config/website.ts
mail: {
  enable: true,
  provider: 'cloudflare',
  fromEmail: 'MyApp <support@example.com>',
}
```

> **Note:** The `fromEmail` address must be on a verified domain in your Cloudflare account.

---

## API

| Export | Description |
|--------|-------------|
| **sendEmail(params)** | `SendTemplateParams` → render template + send; `SendRawEmailParams` → send raw. Returns `Promise<SendEmailResult>`. |
| **getMailProvider()** | Lazy-initialized provider from `websiteConfig.mail.provider`. |
| **getTemplate({ template, context })** | Returns `{ html, text, subject }`; used by providers internally. |

**Types (re-exported):** `EmailTemplate`, `MailProviderName`, `SendTemplateParams`, `SendRawEmailParams`.

---

## Templates

| Template | Context | Subject (in render.ts) |
|----------|---------|---------------------------|
| forgotPassword | `{ url, name }` | Reset your password |
| verifyEmail | `{ url, name }` | Verify your email |
| subscribeNewsletter | `{ email? }` | Thanks for subscribing |
| contactMessage | `{ name, email, message }` | Contact Message from Website |

**Adding a template:** extend `EmailTemplate` in `types.ts` → add to `EmailTemplates` and `subjectByTemplate` in `render.ts` → add React component under `templates/`.

---

## Adding a new mail provider

The module uses a **provider registry** (`providerRegistry` in `index.ts`). To add a new provider:

1. **Types** — In `src/types/index.d.ts`, extend `MailConfig.provider` union (e.g. `'resend' | 'cloudflare' | 'newprovider'`).
2. **Implementation** — Add `src/mail/provider/<name>.ts` implementing `MailProvider` (`sendTemplate`, `sendRawEmail`, `getProviderName`). Use `getTemplate` from `../render` for template-based sends.
3. **Registration** — In `src/mail/index.ts`, add a factory to `providerRegistry`: `newprovider: () => new NewProvider(...)`, reading provider-specific env/bindings inside.

Callers continue using `sendEmail(...)` only.

---

## Dependencies

- **resend** — Resend SDK (when using Resend provider).
- **React / react-dom/server** — Template rendering (`renderToReadableStream` or `renderToStaticMarkup`).
