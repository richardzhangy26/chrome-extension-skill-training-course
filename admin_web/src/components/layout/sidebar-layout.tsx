import { DashboardSidebar } from '@/components/layout/dashboard-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { Spinner } from '@/components/ui/spinner';
import { authClient } from '@/auth/client';
import { Routes } from '@/lib/routes';
import { Outlet, useNavigate } from '@tanstack/react-router';
import { useEffect, type ReactNode } from 'react';

/**
 * Shared layout for /dashboard /settings and /admin routes
 * sidebar + auth guard (redirect to login if no session)
 * use with Outlet as children
 */
export function SidebarLayout({ children }: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (isPending) return;
    if (!session?.user) {
      navigate({ to: Routes.Login });
    }
  }, [session, isPending, navigate]);

  if (isPending) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner className="size-6" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  return (
    <SidebarProvider
      className="min-h-svh flex"
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 72)',
          '--header-height': 'calc(var(--spacing) * 12)',
        } as React.CSSProperties
      }
    >
      <DashboardSidebar variant="inset" />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}

/**
 * Pre-composed layout for route files: SidebarLayout + Outlet.
 * Use as `component: SidebarLayoutPage` in route definitions.
 */
export function SidebarLayoutPage() {
  return (
    <SidebarLayout>
      <Outlet />
    </SidebarLayout>
  );
}
