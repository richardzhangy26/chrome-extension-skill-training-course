import { m } from '@/locale/paraglide/messages';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { NewsletterFormCard } from '@/components/settings/notification/newsletter-form-card';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/notifications')({
  component: NotificationsPage,
});

function NotificationsPage() {
  const breadcrumbs = [
    { label: m.common_settings(), isCurrentPage: false },
    { label: m.settings_notification_title(), isCurrentPage: true },
  ];
  return (
    <DashboardLayout
      breadcrumbs={breadcrumbs}
      title={m.settings_notification_title()}
      description={m.settings_notification_description()}
    >
      <div className="flex flex-col gap-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <NewsletterFormCard />
        </div>
      </div>
    </DashboardLayout>
  );
}
