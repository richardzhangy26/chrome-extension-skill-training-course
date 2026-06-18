import { m } from '@/locale/paraglide/messages';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ApiKeysPageContent } from '@/components/settings/apikeys/apikeys-page-content';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/apikeys')({
  component: ApiKeysPage,
});

function ApiKeysPage() {
  const breadcrumbs = [
    { label: m.common_settings(), isCurrentPage: false },
    { label: m.settings_api_keys_title(), isCurrentPage: true },
  ];
  return (
    <DashboardLayout
      breadcrumbs={breadcrumbs}
      title={m.settings_api_keys_title()}
      description={m.settings_api_keys_description()}
    >
      <ApiKeysPageContent />
    </DashboardLayout>
  );
}
