import { getAuthErrorMessages } from '@/lib/locale';
import { m } from '@/locale/paraglide/messages';
import { AuthCard } from '@/components/auth/auth-card';
import { Routes } from '@/lib/routes';
import { IconAlertTriangle } from '@tabler/icons-react';
function getDisplayMessage(
  errorCode: string | undefined,
  errorDescription: string | undefined
): string {
  const authErrorMessages = getAuthErrorMessages();
  if (errorCode && authErrorMessages[errorCode]) {
    return authErrorMessages[errorCode];
  }
  if (errorDescription) {
    return errorDescription;
  }
  if (errorCode) {
    return errorCode;
  }
  return m.auth_error_try_again();
}
export function ErrorCard({
  errorCode,
  errorDescription,
}: {
  errorCode?: string;
  errorDescription?: string;
} = {}) {
  const displayMessage = getDisplayMessage(errorCode, errorDescription);
  return (
    <AuthCard
      headerLabel={m.auth_error_title()}
      bottomButtonHref={Routes.Login}
      bottomButtonLabel={m.auth_error_back_to_login()}
      className="border-none"
    >
      <div className="w-full flex flex-col justify-center items-center py-4 gap-2">
        <div className="flex items-center gap-2">
          <IconAlertTriangle className="text-destructive size-4 shrink-0" />
          <p className="font-medium text-destructive text-center">
            {displayMessage}
          </p>
        </div>
      </div>
    </AuthCard>
  );
}
