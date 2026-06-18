import { createFileRoute, redirect } from '@tanstack/react-router';
import { ErrorCard } from '@/components/auth/error-card';
import { websiteConfig } from '@/config/website';
import { Routes } from '@/lib/routes';

export const Route = createFileRoute('/auth/error')({
  beforeLoad: () => {
    if (!websiteConfig.auth?.enable) {
      throw redirect({ to: Routes.Root });
    }
  },
  validateSearch: (search: Record<string, unknown>) => ({
    error: typeof search.error === 'string' ? search.error : undefined,
    error_description:
      typeof search.error_description === 'string'
        ? search.error_description
        : undefined,
  }),
  component: AuthErrorPage,
});

function AuthErrorPage() {
  const { error, error_description } = Route.useSearch();
  return <ErrorCard errorCode={error} errorDescription={error_description} />;
}
