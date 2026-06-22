import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ExtensionHistoryView } from '@/components/settings/history/extension-history-view';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/history')({
  component: ExtensionHistoryPage,
});

function ExtensionHistoryPage() {
  const breadcrumbs = [
    { label: '设置', isCurrentPage: false },
    { label: '插件历史', isCurrentPage: true },
  ];
  return (
    <DashboardLayout breadcrumbs={breadcrumbs} title="插件历史" description="查看插件上传的训练对话历史（只读）。">
      <ExtensionHistoryView />
    </DashboardLayout>
  );
}
