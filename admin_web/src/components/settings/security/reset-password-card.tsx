import { m } from '@/locale/paraglide/messages';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { authClient } from '@/auth/client';
import { cn } from '@/lib/utils';
import { useNavigate } from '@tanstack/react-router';
import { Routes } from '@/lib/routes';
interface ResetPasswordCardProps {
  className?: string;
}
/**
 * For users who signed up with social providers: guide them to set a password via forgot-password flow.
 */
export function ResetPasswordCard({ className }: ResetPasswordCardProps) {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const handleSetupPassword = () => {
    const email = session?.user?.email;
    const path = email
      ? `${Routes.ForgotPassword}?email=${encodeURIComponent(email)}`
      : Routes.ForgotPassword;
    navigate({ to: path });
  };
  return (
    <Card
      className={cn(
        'w-full overflow-hidden pt-6 pb-0 flex flex-col',
        className
      )}
    >
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          {m.settings_security_reset_password_title()}
        </CardTitle>
        <CardDescription>
          {m.settings_security_reset_password_description()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 flex-1">
        <p className="text-sm text-muted-foreground">
          {m.settings_security_reset_password_info()}
        </p>
      </CardContent>
      <CardFooter className="mt-auto px-6 py-4 flex justify-end items-center bg-muted rounded-none">
        <Button onClick={handleSetupPassword}>
          {m.settings_security_reset_password_button()}
        </Button>
      </CardFooter>
    </Card>
  );
}
