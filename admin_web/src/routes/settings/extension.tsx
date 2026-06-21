import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ExtensionConfigForm } from '@/components/settings/extension/extension-config-form';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/extension')({
  component: ExtensionSettingsPage,
});

function ExtensionSettingsPage() {
  const breadcrumbs = [
    { label: '设置', isCurrentPage: false },
    { label: '插件配置', isCurrentPage: true },
  ];
  return (
    <DashboardLayout
      breadcrumbs={breadcrumbs}
      title="插件配置"
      description="集中配置 Chrome 插件使用的 LLM 与学生档位，登录后插件自动拉取。">
      <ExtensionConfigForm />
    </DashboardLayout>
  );
}
