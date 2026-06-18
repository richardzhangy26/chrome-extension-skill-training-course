import { m } from '@/locale/paraglide/messages';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { UpdateAvatarCard } from '@/components/settings/profile/update-avatar-card';
import { UpdateNameCard } from '@/components/settings/profile/update-name-card';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/profile')({
  component: ProfilePage,
});

function ProfilePage() {
  const breadcrumbs = [
    { label: m.common_settings(), isCurrentPage: false },
    { label: m.settings_profile_title(), isCurrentPage: true },
  ];
  return (
    <DashboardLayout
      breadcrumbs={breadcrumbs}
      title={m.settings_profile_title()}
      description={m.settings_profile_description()}
    >
      <div className="flex flex-col gap-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <UpdateNameCard />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <UpdateAvatarCard />
        </div>
      </div>
    </DashboardLayout>
  );
}
