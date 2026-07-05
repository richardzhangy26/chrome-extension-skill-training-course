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
export const authRouteMiddleware = createMiddleware().server(async ({ next }) => {
  if (!websiteConfig.auth?.enable) {
    throw redirect({ to: Routes.Root });
  }

  const headers = getRequestHeaders();
  const { auth } = await import('@/auth/auth');
  const session = await auth.api.getSession({ headers });

  if (!session?.user) {
    throw redirect({ to: Routes.Login });
  }

  if (!session.user.emailVerified) {
    // 注意：不要带 search 参数。/auth/login 未声明 validateSearch，
    // 带 search 的 redirect 在当前 h3/TanStack Start 版本下会让响应状态码越界
    // （"Responses may only be constructed with status codes in the range 200 to 599"）。
    // 与未登录分支保持一致：跳到纯 /auth/login。
    throw redirect({ to: Routes.Login });
  }

  return await next();
});

/**
 * Auth API middleware: same as authMiddleware but returns 401 JSON for API routes.
 * Passes context: { userId } so server function handlers can use context.userId.
 */
export const authApiMiddleware = createMiddleware().server(async ({ next }) => {
  const headers = getRequestHeaders();
  const { auth } = await import('@/auth/auth');
  const session = await auth.api.getSession({ headers });

  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  if (!session.user.emailVerified) {
    return Response.json(
      { error: 'Email not verified', code: 'email_not_verified' },
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return await next({ context: { userId: session.user.id } });
});
