import { auth } from '@/auth/auth';
import { redirect } from '@tanstack/react-router';
import { createMiddleware } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { DEFAULT_LOGIN_REDIRECT, Routes } from '@/lib/routes';
import { websiteConfig } from '@/config/website';

/**
 * Guest Route middleware: redirects authenticated users to the dashboard.
 * Use on public auth pages (login, register) to prevent logged-in users
 * from seeing them.
 */
export const guestRouteMiddleware = createMiddleware().server(
  async ({ next }) => {
    if (!websiteConfig.auth?.enable) {
      throw redirect({ to: Routes.Root });
    }

    const headers = getRequestHeaders();
    const session = await auth.api.getSession({ headers });

    if (session?.user) {
      throw redirect({ to: DEFAULT_LOGIN_REDIRECT });
    }

    return await next();
  }
);
