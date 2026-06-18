# Payment (Stripe / Creem)

Subscription and one-time payment support via a **provider pattern** — switch between Stripe and Creem by setting the `VITE_PAYMENT_PROVIDER` env var (`'stripe'` or `'creem'`). Set it to `''` (empty, the default) to disable payment entirely. Both providers implement the same `PaymentProvider` interface, so all downstream code (checkout, billing, webhooks) is provider-agnostic. See [Env](./env.md) for all variables.

### Shared routes

- **Pricing**: `/pricing` — plans and checkout buttons.
- **Payment callback**: `/payment?session_id=...&callback=/settings/billing` — polls until paid, then redirects.
- **Billing**: `/settings/billing` — current plan and subscription management.

### Shared server API (Server Functions)

- `createCheckoutSession` — create a checkout session, redirect URL returned.
- `createCustomerPortalSession` — create a billing portal session (Stripe Customer Portal / Creem customer portal).
- `getCurrentPlan` — current plan and subscription for a user.
- `checkPaymentCompletion` — whether a session is paid (for polling).

### Module layout

| Path | Purpose |
|------|---------|
| `src/payment/types.ts` | `PaymentProvider` interface, shared types |
| `src/payment/index.ts` | Provider factory/registry, exported functions |
| `src/payment/constants.ts` | Polling/retry constants |
| `src/payment/provider/stripe.ts` | Stripe provider implementation |
| `src/payment/provider/creem.ts` | Creem provider implementation |
| `src/api/payment.ts` | Server functions (provider-agnostic) |
| `src/lib/price-plan.ts` | Plan/price helpers from config |
| `src/config/website.ts` | `price.plans` and env-based price/product IDs |

---

## Stripe

### Setup

1. **Env**: Set the following environment variables (see [Env](./env.md)):
   - **Runtime (secrets):** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
   - **Build-time:** `VITE_PAYMENT_PROVIDER=stripe`, `VITE_STRIPE_PRICE_PRO_MONTHLY`, `VITE_STRIPE_PRICE_PRO_YEARLY`, `VITE_STRIPE_PRICE_LIFETIME` (Stripe Price IDs)

2. **DB**: Schema adds `user.customerId` and `payment` table. Generate and apply migrations:
   - `pnpm db:generate`
   - Then apply with your D1 workflow (e.g. `pnpm db:migrate:remote` or `pnpm db:migrate:local`)

3. **Stripe Dashboard**:
   - Create Products/Prices for Pro (monthly/yearly) and Lifetime.
   - Webhook: `https://your-domain.com/api/webhooks/stripe`
     Events: `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.paid`.

### Billing portal

Stripe provides a built-in **Customer Portal** for managing subscriptions (upgrade, cancel, update payment method). Accessed via the "Manage subscription" button on `/settings/billing`.

---

## Creem

[Creem](https://creem.io) is a merchant-of-record (MoR) payment platform. It handles global tax compliance, payouts, and provides a simpler setup compared to Stripe.

### Setup

1. **Env**: Set the following environment variables (see [Env](./env.md)):
   - **Runtime (secrets):** `CREEM_API_KEY`, `CREEM_WEBHOOK_SECRET`
   - **Runtime (optional):** `CREEM_DEBUG=true` to use the Creem test/sandbox API (`test-api.creem.io`); omit or set to `false` for production (`api.creem.io`)
   - **Build-time:** `VITE_PAYMENT_PROVIDER=creem`, `VITE_CREEM_PRODUCT_PRO_MONTHLY`, `VITE_CREEM_PRODUCT_PRO_YEARLY`, `VITE_CREEM_PRODUCT_LIFETIME` (Creem Product IDs)

2. **DB**: Same schema as Stripe (`user.customerId`, `payment` table). Generate and apply migrations:
   - `pnpm db:generate`
   - Then apply with your D1 workflow (e.g. `pnpm db:migrate:remote` or `pnpm db:migrate:local`)

3. **Creem Dashboard**:
   - Create Products for Pro (monthly/yearly) and Lifetime.
   - Webhook: Settings → Webhooks → Add endpoint: `https://your-domain.com/api/webhooks/creem`
     Events: `checkout.completed`, `subscription.paid`, `subscription.canceled`, `subscription.expired`, `subscription.trialing`, `subscription.paused`.

### Key differences from Stripe

- Creem uses **Product IDs** (not Price IDs) for checkout.
- Creem is a **merchant of record** — it handles tax, VAT, and payouts on your behalf.
- Creem provides a **customer portal** for subscription management, similar to Stripe's Customer Portal.
- Debug/sandbox mode is toggled via the `CREEM_DEBUG` env var.
