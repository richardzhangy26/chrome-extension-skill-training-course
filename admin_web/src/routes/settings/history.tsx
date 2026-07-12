import { m } from '@/locale/paraglide/messages';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ExtensionHistoryView } from '@/components/settings/history/extension-history-view';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/history')({
  component: ExtensionHistoryPage,
});

function ExtensionHistoryPage() {
  const breadcrumbs = [
    { label: m.common_settings(), isCurrentPage: false },
    { label: m.settings_history_title(), isCurrentPage: true },
  ];
  return (
    <DashboardLayout
      breadcrumbs={breadcrumbs}
      title={m.settings_history_title()}
      description={m.settings_history_description()}>
      <ExtensionHistoryView />
    </DashboardLayout>
  );
}
