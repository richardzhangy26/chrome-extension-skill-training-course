import { m } from '@/locale/paraglide/messages';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { DeleteAccountCard } from '@/components/settings/security/delete-account-card';
import { PasswordCardWrapper } from '@/components/settings/security/password-card-wrapper';
import { websiteConfig } from '@/config/website';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/security')({
  component: SecurityPage,
});

function SecurityPage() {
  const breadcrumbs = [
    { label: m.common_settings(), isCurrentPage: false },
    { label: m.settings_security_title(), isCurrentPage: true },
  ];
  const credentialLoginEnabled =
    websiteConfig.auth?.enableCredentialLogin ?? false;
  const deleteAccountEnabled = websiteConfig.auth?.enableDeleteAccount ?? false;
  return (
    <DashboardLayout
      breadcrumbs={breadcrumbs}
      title={m.settings_security_title()}
      description={m.settings_security_description()}
    >
      <div className="flex flex-col gap-8">
        {credentialLoginEnabled && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <PasswordCardWrapper />
          </div>
        )}
        {deleteAccountEnabled && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <DeleteAccountCard />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
