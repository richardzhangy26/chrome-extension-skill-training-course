import { DashboardHeader } from '@/components/layout/dashboard-header';
import type { DashboardBreadcrumbItem } from '@/components/layout/dashboard-header';

interface DashboardLayoutProps {
  breadcrumbs: DashboardBreadcrumbItem[];
  title: string;
  description: string;
  children: React.ReactNode;
}

/**
 * Shared layout for dashboard/admin/settings routes
 * header with breadcrumbs + title/description + content
 */
export function DashboardLayout({
  breadcrumbs,
  title,
  description,
  children,
}: DashboardLayoutProps) {
  return (
    <>
      <DashboardHeader breadcrumbs={breadcrumbs} />
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 px-4 lg:gap-6 lg:py-6 lg:px-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            <p className="text-muted-foreground mt-2">{description}</p>
          </div>
          {children}
        </div>
      </div>
    </>
  );
}
