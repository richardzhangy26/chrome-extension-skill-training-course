import { SidebarLayoutPage } from '@/components/layout/sidebar-layout';
import { authRouteMiddleware } from '@/middlewares/auth-middleware';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/dashboard')({
  ssr: false,
  component: SidebarLayoutPage,
  server: {
    middleware: [authRouteMiddleware],
  },
});
