import { SidebarLayoutPage } from '@/components/layout/sidebar-layout';
import { adminRouteMiddleware } from '@/middlewares/admin-middleware';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/admin')({
  ssr: false,
  component: SidebarLayoutPage,
  server: {
    middleware: [adminRouteMiddleware],
  },
});
