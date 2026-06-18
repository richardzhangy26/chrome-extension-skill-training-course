import { m } from '@/locale/paraglide/messages';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { websiteConfig } from '@/config/website';
import { Routes } from '@/lib/routes';

export const Route = createFileRoute('/auth/forgot-password')({
  beforeLoad: () => {
    if (!websiteConfig.auth?.enable) {
      throw redirect({ to: Routes.Root });
    }
  },
  component: ForgotPasswordPage,
  head: () => ({
    meta: [
      { title: m.auth_forgot_password_title() },
      { name: 'description', content: m.auth_forgot_password_description() },
    ],
  }),
});

function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
