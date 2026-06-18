import { m } from '@/locale/paraglide/messages';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { BillingCard } from '@/components/settings/billing/billing-card';
import { websiteConfig } from '@/config/website';
import { Routes } from '@/lib/routes';

export const Route = createFileRoute('/settings/billing')({
  beforeLoad: () => {
    if (websiteConfig.payment?.enable === false) {
      throw redirect({ to: Routes.SettingsProfile });
    }
  },
  component: BillingPage,
});

function BillingPage() {
  const breadcrumbs = [
    { label: m.common_settings(), isCurrentPage: false },
    { label: m.settings_billing_breadcrumb(), isCurrentPage: true },
  ];
  return (
    <DashboardLayout
      breadcrumbs={breadcrumbs}
      title={m.settings_billing_title()}
      description={m.settings_billing_description()}
    >
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <BillingCard />
      </div>
    </DashboardLayout>
  );
}
