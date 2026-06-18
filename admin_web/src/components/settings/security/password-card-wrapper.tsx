import { m } from '@/locale/paraglide/messages';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useHasCredentialProvider } from '@/hooks/use-auth';
import { authClient } from '@/auth/client';
import { cn } from '@/lib/utils';
import { UpdatePasswordCard } from './update-password-card';
import { ResetPasswordCard } from './reset-password-card';
export function PasswordCardWrapper() {
  const { data: session } = authClient.useSession();
  const { hasCredentialProvider, isLoading, error } = useHasCredentialProvider(
    session?.user?.id
  );
  if (error) {
    console.error('check credential provider error:', error);
    return null;
  }
  if (isLoading) {
    return (
      <Card className={cn('w-full overflow-hidden pt-6 pb-0 flex flex-col')}>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            {m.settings_security_update_password_title()}
          </CardTitle>
          <CardDescription>
            {m.settings_security_update_password_description()}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col space-y-3 flex-1">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-6 w-full" />
        </CardContent>
        <CardFooter className="px-6 py-4 flex justify-end items-center bg-muted rounded-none">
          <Skeleton className="h-8 w-1/4" />
        </CardFooter>
      </Card>
    );
  }
  if (hasCredentialProvider) return <UpdatePasswordCard />;
  if (session?.user?.email) return <ResetPasswordCard />;
  return null;
}
