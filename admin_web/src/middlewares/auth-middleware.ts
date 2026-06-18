import { auth } from '@/auth/auth';
import { redirect } from '@tanstack/react-router';
import { createMiddleware } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { Routes } from '@/lib/routes';
import { websiteConfig } from '@/config/website';

/**
 * Auth Route middleware: requires authenticated user.
 * Use in route definitions via server: { middleware: [authMiddleware] }.
 * https://www.better-auth.com/docs/integrations/tanstack#middleware
 */
export const authRouteMiddleware = createMiddleware().server(
  async ({ next }) => {
    if (!websiteConfig.auth?.enable) {
      throw redirect({ to: Routes.Root });
    }

    const headers = getRequestHeaders();
    const session = await auth.api.getSession({ headers });

    if (!session?.user) {
      throw redirect({ to: Routes.Login });
    }

    if (!session.user.emailVerified) {
      throw redirect({
        to: Routes.Login,
        search: { error: 'email_not_verified' },
      });
    }

    return await next();
  }
);

/**
 * Auth API middleware: same as authMiddleware but returns 401 JSON for API routes.
 * Passes context: { userId } so server function handlers can use context.userId.
 */
export const authApiMiddleware = createMiddleware().server(async ({ next }) => {
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });

  if (!session?.user) {
    return Response.json(
      { error: 'Unauthorized' },
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!session.user.emailVerified) {
    return Response.json(
      { error: 'Email not verified', code: 'email_not_verified' },
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return await next({ context: { userId: session.user.id } });
});
