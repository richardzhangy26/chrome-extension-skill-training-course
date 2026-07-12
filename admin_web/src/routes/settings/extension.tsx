import { m } from '@/locale/paraglide/messages';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ExtensionConfigForm } from '@/components/settings/extension/extension-config-form';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/extension')({
  component: ExtensionSettingsPage,
});

function ExtensionSettingsPage() {
  const breadcrumbs = [
    { label: m.common_settings(), isCurrentPage: false },
    { label: m.settings_extension_title(), isCurrentPage: true },
  ];
  return (
    <DashboardLayout
      breadcrumbs={breadcrumbs}
      title={m.settings_extension_title()}
      description={m.settings_extension_description()}>
      <ExtensionConfigForm />
    </DashboardLayout>
  );
}
