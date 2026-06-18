import { m } from '@/locale/paraglide/messages';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { FilesPageContent } from '@/components/settings/files/files-page-content';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/files')({
  component: FilesPage,
});

function FilesPage() {
  const breadcrumbs = [
    { label: m.common_settings(), isCurrentPage: false },
    { label: m.settings_files_title(), isCurrentPage: true },
  ];
  return (
    <DashboardLayout
      breadcrumbs={breadcrumbs}
      title={m.settings_files_title()}
      description={m.settings_files_description()}
    >
      <FilesPageContent />
    </DashboardLayout>
  );
}
