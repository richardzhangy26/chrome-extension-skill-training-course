import { redirect } from '@tanstack/react-router';
import { createMiddleware } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { Routes } from '@/lib/routes';
import { websiteConfig } from '@/config/website';

const ADMIN_ROLE = 'admin';

function forbiddenResponse() {
  return Response.json(
    { success: false, error: 'Forbidden' },
    { status: 403, headers: { 'Content-Type': 'application/json' } },
  );
}

function unauthorizedResponse() {
  return Response.json(
    { success: false, error: 'Unauthorized' },
    { status: 401, headers: { 'Content-Type': 'application/json' } },
  );
}

/**
 * Admin Route middleware: requires authenticated user with role === 'admin'.
 * Use after auth or alone (redirects to login if not signed in, then to dashboard if not admin).
 */
export const adminRouteMiddleware = createMiddleware().server(async ({ next }) => {
  if (!websiteConfig.auth?.enable) {
    throw redirect({ to: Routes.Root });
  }

  const headers = getRequestHeaders();
  const { auth } = await import('@/auth/auth');
  const session = await auth.api.getSession({ headers });

  if (!session?.user) {
    throw redirect({ to: Routes.Login });
  }

  const role = session.user.role;
  if (role !== ADMIN_ROLE) {
    throw redirect({ to: Routes.Dashboard });
  }

  return await next();
});

/**
 * Admin API middleware: same check as adminMiddleware but returns 401/403 Response for API routes.
 * Passes context: { userId } so server function handlers can use them.
 */
export const adminApiMiddleware = createMiddleware().server(async ({ next }) => {
  const headers = getRequestHeaders();
  const { auth } = await import('@/auth/auth');
  const session = await auth.api.getSession({ headers });

  if (!session?.user) {
    return unauthorizedResponse();
  }
  if (session.user.role !== ADMIN_ROLE) {
    return forbiddenResponse();
  }

  return await next({
    context: {
      userId: session.user.id,
    },
  });
});
