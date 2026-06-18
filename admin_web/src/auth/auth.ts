import type { User } from 'better-auth';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { getDb } from '@/db';
import { sendEmail } from '@/mail';
import { subscribe } from '@/newsletter';
import { getBaseUrl } from '@/lib/urls';
import { serverEnv } from '@/env/server';
import { websiteConfig } from '@/config/website';
import { emailHarmony } from 'better-auth-harmony';
import { admin, apiKey } from 'better-auth/plugins';

/**
 * Better Auth Configuration
 * https://www.better-auth.com/docs/reference/options
 * https://www.better-auth.com/docs/adapters/drizzle
 */
export const auth = betterAuth({
  baseURL: getBaseUrl(),
  appName: websiteConfig.metadata?.name,
  database: drizzleAdapter(getDb(), {
    provider: 'sqlite',
  }),
  session: {
    // https://www.better-auth.com/docs/concepts/session-management#cookie-cache
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60, // Cache duration in seconds
    },
    // https://www.better-auth.com/docs/concepts/session-management#session-expiration
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    // https://www.better-auth.com/docs/concepts/session-management#session-freshness
    // https://www.better-auth.com/docs/concepts/users-accounts#authentication-requirements
    // disable freshness check for user deletion
    freshAge: 0 /* 60 * 60 * 24 */,
  },
  emailAndPassword: {
    // https://discord.com/channels/1300839113142046730/1300839113594769431/1454280549060444393
    enabled: websiteConfig.auth?.enableCredentialLogin ?? false,
    // https://www.better-auth.com/docs/concepts/email#2-require-email-verification
    requireEmailVerification: true,
    // https://www.better-auth.com/docs/authentication/email-password#forget-password
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        template: 'forgotPassword',
        context: { url, name: user.name ?? '' },
      });
    },
  },
  emailVerification: {
    // https://www.better-auth.com/docs/concepts/email#auto-signin-after-verification
    autoSignInAfterVerification: true,
    // https://www.better-auth.com/docs/authentication/email-password#require-email-verification
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        template: 'verifyEmail',
        context: { url, name: user.name ?? '' },
      });
    },
    sendOnSignIn: true,
  },
  socialProviders: {
    // https://www.better-auth.com/docs/authentication/google
    ...(websiteConfig.auth?.enableGoogleLogin &&
    serverEnv.GOOGLE_CLIENT_ID &&
    serverEnv.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: serverEnv.GOOGLE_CLIENT_ID,
            clientSecret: serverEnv.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
  },
  account: {
    // https://www.better-auth.com/docs/concepts/users-accounts#account-linking
    accountLinking: {
      enabled: websiteConfig.auth?.enableGoogleLogin,
      trustedProviders: websiteConfig.auth?.enableGoogleLogin ? ['google'] : [],
    },
  },
  user: {
    // https://www.better-auth.com/docs/concepts/database#extending-core-schema
    additionalFields: {
      customerId: {
        type: 'string',
        required: false,
      },
    },
    // https://www.better-auth.com/docs/concepts/users-accounts#delete-user
    deleteUser: {
      enabled: websiteConfig.auth?.enableDeleteAccount ?? false,
    },
  },
  databaseHooks: {
    // https://www.better-auth.com/docs/concepts/database#database-hooks
    user: {
      create: {
        after: async (user) => {
          await onCreateUser(user);
        },
      },
    },
  },
  plugins: [
    // https://www.better-auth.com/docs/integrations/tanstack
    tanstackStartCookies(),
    // https://www.better-auth.com/docs/plugins/admin
    // support user management, ban/unban user, manage user roles, etc.
    admin({
      // https://www.better-auth.com/docs/plugins/admin#default-ban-reason
      // defaultBanReason: 'Spamming',
      defaultBanExpiresIn: undefined,
      bannedUserMessage:
        'You have been banned from this application. Please contact support if you believe this is an error.',
    }),
    // https://www.better-auth.com/docs/plugins/api-key
    // support API key management for user authentication
    apiKey(),
    // https://github.com/gekorm/better-auth-harmony
    // email normalization and validation to prevent duplicate registrations
    emailHarmony({
      // Don't allow login with any version of the unnormalized email address
      // e.g., user signed up with johndoe@googlemail.com can't login with john.doe@gmail.com
      // e.g., user signed up with johndoe@googlemail.com can't login with johndoe+abc@gmail.com
      allowNormalizedSignin: false,
    }),
  ],
  onAPIError: {
    // https://www.better-auth.com/docs/reference/options#onapierror
    errorURL: '/auth/error',
    onError: (error, _ctx) => {
      console.error('auth error:', error);
    },
  },
});

/**
 * Runs after a new user is created. Auto-subscribes to newsletter when enabled.
 */
async function onCreateUser(user: User) {
  const newsletterConfig = websiteConfig.newsletter;
  if (
    !user.email ||
    !newsletterConfig?.enable ||
    !newsletterConfig.autoSubscribeAfterSignUp
  ) {
    return;
  }

  try {
    const subscribed = await subscribe(user.email);
    if (!subscribed) {
      console.error(`onCreateUser, user ${user.email} failed to subscribe`);
    } else {
      console.log(`onCreateUser, user ${user.email} subscribed to newsletter`);
    }
  } catch (error) {
    console.error('onCreateUser, newsletter subscription error:', error);
  }
}
