import { m } from '@/locale/paraglide/messages';
import { FormError } from '@/components/shared/form-error';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { useState } from 'react';
import { toast } from 'sonner';
import { useNavigate } from '@tanstack/react-router';
export function DeleteAccountCard() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState<string | undefined>('');
  const { data: session, refetch } = authClient.useSession();
  const navigate = useNavigate();
  const user = session?.user;
  if (!user) return null;
  const handleDeleteAccount = async () => {
    await authClient.deleteUser(
      {},
      {
        onRequest: () => {
          setIsDeleting(true);
          setError('');
        },
        onResponse: () => {
          setIsDeleting(false);
          setShowConfirmation(false);
        },
        onSuccess: () => {
          toast.success(m.settings_security_delete_account_success());
          refetch();
          navigate({ to: '/' });
        },
        onError: (ctx) => {
          setError(`${ctx.error.status}: ${ctx.error.message}`);
          toast.error(m.settings_security_delete_account_fail());
        },
      }
    );
  };
  return (
    <Card
      className={cn(
        'w-full border-destructive/50 overflow-hidden pt-6 pb-0 flex flex-col'
      )}
    >
      <CardHeader>
        <CardTitle className="text-lg font-bold text-destructive">
          {m.settings_security_delete_account_title()}
        </CardTitle>
        <CardDescription>
          {m.settings_security_delete_account_description()}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <p className="text-sm text-muted-foreground">
          {m.settings_security_delete_account_warning()}
        </p>
        {error && (
          <div className="mt-4">
            <FormError message={error} />
          </div>
        )}
      </CardContent>
      <CardFooter className="mt-2 px-6 py-4 flex justify-end items-center bg-muted rounded-none">
        <Button variant="destructive" onClick={() => setShowConfirmation(true)}>
          {m.settings_security_delete_account_button()}
        </Button>
      </CardFooter>

      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              {m.settings_security_delete_account_confirm_title()}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {m.settings_security_delete_account_confirm_description()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowConfirmation(false)}
            >
              {m.settings_security_delete_account_cancel()}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={isDeleting}
            >
              {isDeleting
                ? m.settings_security_delete_account_deleting()
                : m.settings_security_delete_account_confirm()}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
