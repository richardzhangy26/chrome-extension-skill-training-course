import { m } from '@/locale/paraglide/messages';
import { getAvatarLinks } from '@/config/avatar-config';
import { authClient } from '@/auth/client';
import { IconLogout } from '@tabler/icons-react';
import { Link, useRouter } from '@tanstack/react-router';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserAvatar } from './user-avatar';
import { useState } from 'react';
import { toast } from 'sonner';
import type { SessionUser } from '@/auth/types';
interface UserButtonProps {
  user: SessionUser;
}
export function UserButton({ user }: UserButtonProps) {
  const router = useRouter();
  const avatarLinks = getAvatarLinks();
  const [open, setOpen] = useState(false);
  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.navigate({ to: '/' });
        },
        onError: (err) => {
          toast.error(m.auth_common_logout_failed());
          console.error('sign out error:', err);
        },
      },
    });
  };
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger aria-label={m.common_user_menu()}>
        <UserAvatar
          name={user.name ?? null}
          image={user.image ?? null}
          className="size-8 border"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="flex items-center gap-2 p-2">
          <div className="flex flex-col space-y-1 leading-none">
            <p className="font-medium">{user.name}</p>
            <p className="truncate text-sm text-muted-foreground">
              {user.email}
            </p>
          </div>
        </div>
        <DropdownMenuSeparator />
        {avatarLinks.map((item) =>
          item.href ? (
            <Link key={item.title} to={item.href} className="block">
              <DropdownMenuItem>
                {item.icon ? <item.icon className="mr-2 size-4" /> : null}
                {item.title}
              </DropdownMenuItem>
            </Link>
          ) : null
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async (event) => {
            event.preventDefault();
            setOpen(false);
            await handleSignOut();
          }}
        >
          <IconLogout className="mr-2 size-4" />
          {m.auth_common_logout()}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
