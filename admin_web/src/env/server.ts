import { createEnv } from '@t3-oss/env-core';
import * as z from 'zod';

/**
 * Server-side env (runtime process.env; Worker vars/secrets populate it)
 */
export const serverEnv = createEnv({
  server: {
    // Defaults so CLI (e.g. auth:schema:generate via pnpm dlx) can run without loading .env.local
    VITE_BASE_URL: z.url().default('http://localhost:3000'),

    // Auth (Better Auth)
    BETTER_AUTH_SECRET: z.string().default('better-auth-secret'),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),

    // Mail and Newsletter (Resend)
    RESEND_API_KEY: z.string().optional(),

    // Mail (Cloudflare Email)
    CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
    CLOUDFLARE_API_TOKEN: z.string().optional(),

    // Newsletter (Beehiiv)
    BEEHIIV_API_KEY: z.string().optional(),
    BEEHIIV_PUBLICATION_ID: z.string().optional(),

    // Notification (Discord and Feishu)
    DISCORD_WEBHOOK_URL: z.string().optional(),
    FEISHU_WEBHOOK_URL: z.string().optional(),

    // Payment (Stripe)
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),

    // Payment (Creem)
    CREEM_DEBUG: z.string().optional(),
    CREEM_API_KEY: z.string().optional(),
    CREEM_WEBHOOK_SECRET: z.string().optional(),

    // AI image generation (fal.ai)
    FAL_KEY: z.string().optional(),
  },
  runtimeEnv: process.env,
});
