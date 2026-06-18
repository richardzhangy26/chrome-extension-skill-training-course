import { m } from '@/locale/paraglide/messages';
import { authClient } from '@/auth/client';
import { getAvatarLinks } from '@/config/avatar-config';
import type { SessionUser } from '@/auth/types';
import { IconLogout } from '@tabler/icons-react';
import { Link, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { UserAvatar } from '@/components/shared/user-avatar';
interface UserButtonMobileProps {
  user: SessionUser;
}
/**
 * Mobile user button
 */
export function UserButtonMobile({ user }: UserButtonMobileProps) {
  const router = useRouter();
  const avatarLinks = getAvatarLinks();
  const [open, setOpen] = useState(false);
  const closeDrawer = () => setOpen(false);
  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          closeDrawer();
          router.navigate({ to: '/' });
        },
        onError: (err) => {
          toast.error(m.auth_common_logout_failed());
          console.error(err);
        },
      },
    });
  };
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <button type="button" aria-label={m.common_open_user_menu()}>
          <UserAvatar
            name={user.name ?? null}
            image={user.image ?? null}
            className="size-8 shrink-0 border"
          />
        </button>
      </DrawerTrigger>
      <DrawerContent className="rounded-t-[10px] border-t px-3 pb-12 text-sm">
        <DrawerHeader className="p-2 text-left">
          <DrawerTitle className="sr-only">{m.common_user_menu()}</DrawerTitle>
        </DrawerHeader>
        <div className="flex items-center gap-4 p-2">
          <UserAvatar
            name={user.name ?? null}
            image={user.image ?? null}
            className="size-10 shrink-0 border"
          />
          <div className="flex min-w-0 flex-col">
            <p className="font-medium truncate">{user.name}</p>
            <p className="truncate text-muted-foreground text-sm">
              {user.email}
            </p>
          </div>
        </div>

        <ul className="mt-1 w-full text-muted-foreground">
          {avatarLinks.map((item) =>
            item.href ? (
              <li
                key={item.title}
                className="rounded-lg text-foreground hover:bg-muted"
              >
                <Link
                  to={item.href}
                  onClick={closeDrawer}
                  className="flex w-full items-center gap-3 px-2.5 py-2"
                >
                  {item.icon ? <item.icon className="size-4 shrink-0" /> : null}
                  <span className="text-sm">{item.title}</span>
                </Link>
              </li>
            ) : null
          )}
          <li className="rounded-lg text-foreground hover:bg-muted">
            <button
              type="button"
              onClick={() => {
                closeDrawer();
                handleSignOut();
              }}
              className="flex w-full items-center gap-3 px-2.5 py-2 text-left"
            >
              <IconLogout className="size-4 shrink-0" />
              <span className="text-sm">{m.auth_common_logout()}</span>
            </button>
          </li>
        </ul>
      </DrawerContent>
    </Drawer>
  );
}
