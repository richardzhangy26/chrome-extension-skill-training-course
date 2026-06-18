import { m } from '@/locale/paraglide/messages';
import { LoginForm } from '@/components/auth/login-form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Routes } from '@/lib/routes';
import { useRouter } from '@tanstack/react-router';
import React, { useEffect, useState } from 'react';
interface LoginWrapperProps {
  children: React.ReactNode;
  mode?: 'modal' | 'redirect';
  asChild?: boolean;
  callbackUrl?: string;
}
/**
 * Wraps content to trigger login
 * - mode="modal" opens a login dialog
 * - mode="redirect" navigates to the login page
 */
export function LoginWrapper({
  children,
  mode = 'redirect',
  asChild,
  callbackUrl,
}: LoginWrapperProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const handleRedirect = () => {
    const loginPath = callbackUrl
      ? `${Routes.Login}?callbackUrl=${encodeURIComponent(callbackUrl)}`
      : Routes.Login;
    router.navigate({ to: loginPath });
  };
  const handleModalSuccess = () => {
    setOpen(false);
    if (callbackUrl) {
      router.navigate({ to: callbackUrl });
    }
  };
  if (!mounted) {
    return <span>{children}</span>;
  }
  if (mode === 'modal') {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            asChild && React.isValidElement(children) ? (
              children
            ) : (
              <button type="button">{children}</button>
            )
          }
        />
        <DialogContent className="sm:max-w-100 p-0 border-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>{m.auth_login_sign_in()}</DialogTitle>
          </DialogHeader>
          <LoginForm
            callbackUrl={callbackUrl}
            onSuccess={handleModalSuccess}
            className="border-0 shadow-none"
          />
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <button type="button" onClick={handleRedirect} className="inline">
      {children}
    </button>
  );
}
