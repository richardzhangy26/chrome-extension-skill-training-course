import { m } from '@/locale/paraglide/messages';
import type { User } from '@/db/types';
import { UserAvatar } from '@/components/shared/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useBanUser, useUnbanUser } from '@/hooks/use-users';
import { useIsMobile } from '@/hooks/use-mobile';
import { formatDate } from '@/lib/formatter';
import { cn } from '@/lib/utils';
import {
  IconCalendar,
  IconLoader2,
  IconMailCheck,
  IconMailQuestion,
  IconUserCheck,
  IconUserX,
} from '@tabler/icons-react';
import { useState } from 'react';
import { toast } from 'sonner';
interface UserDetailViewerProps {
  user: User;
}
export function UserDetailViewer({ user }: UserDetailViewerProps) {
  const isMobile = useIsMobile();
  const [error, setError] = useState<string | undefined>();
  const [banReason, setBanReason] = useState<string>(
    m.admin_users_ban_default_reason()
  );
  const [banExpiresAt, setBanExpiresAt] = useState<Date | undefined>();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const banUserMutation = useBanUser();
  const unbanUserMutation = useUnbanUser();
  const toDate = (v: Date | string | number | null | undefined): Date | null =>
    v ? new Date(v) : null;
  const handleBan = async () => {
    if (!banReason?.trim()) {
      setError(m.admin_users_ban_error());
      return;
    }
    if (!user.id) {
      setError('User ID is required');
      return;
    }
    setError(undefined);
    try {
      await banUserMutation.mutateAsync({
        userId: user.id,
        banReason: banReason.trim(),
        banExpiresIn: banExpiresAt
          ? Math.floor((banExpiresAt.getTime() - Date.now()) / 1000)
          : undefined,
      });
      toast.success(m.admin_users_ban_success());
      setBanReason(m.admin_users_ban_default_reason());
      setBanExpiresAt(undefined);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : m.admin_users_ban_error();
      setError(msg);
      toast.error(msg);
    }
  };
  const handleUnban = async () => {
    if (!user.id) {
      setError('User ID is required');
      return;
    }
    setError(undefined);
    try {
      await unbanUserMutation.mutateAsync({ userId: user.id });
      toast.success(m.admin_users_unban_success());
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : m.admin_users_unban_error();
      setError(msg);
      toast.error(msg);
    }
  };
  return (
    <Drawer direction={isMobile ? 'bottom' : 'right'}>
      <div className="flex items-center gap-2">
        <UserAvatar
          name={user.name ?? null}
          image={user.image ?? null}
          className="size-8 shrink-0 border"
        />
        <DrawerTrigger asChild>
          <Button
            variant="link"
            className="w-fit px-0 text-left text-foreground"
          >
            <span className="font-medium hover:underline hover:underline-offset-4">
              {user.name}
            </span>
          </Button>
        </DrawerTrigger>
      </div>
      <DrawerContent>
        <DrawerHeader className="gap-1">
          <div className="flex items-center gap-4">
            <UserAvatar
              name={user.name ?? null}
              image={user.image ?? null}
              className="size-12 border"
            />
            <DrawerTitle>{user.name}</DrawerTitle>
          </div>
        </DrawerHeader>
        <div className="flex flex-col gap-4 overflow-y-auto px-4 text-sm">
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  'px-1.5 border-transparent',
                  user.role === 'admin'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400'
                    : 'bg-secondary text-secondary-foreground'
                )}
              >
                {user.role === 'admin'
                  ? m.admin_users_admin()
                  : m.admin_users_user()}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  'px-1.5 border-transparent',
                  user.banned
                    ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                    : 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                )}
              >
                {user.banned ? (
                  <>
                    <IconUserX />
                    {m.admin_users_banned()}
                  </>
                ) : (
                  <>
                    <IconUserCheck />
                    {m.admin_users_active()}
                  </>
                )}
              </Badge>
            </div>
            {user.email && (
              <div className="grid gap-3">
                <span className="text-xs text-muted-foreground">
                  {m.admin_users_columns_email()}:
                </span>
                <Badge
                  variant="outline"
                  className="w-fit px-1.5 py-2 text-sm border-transparent hover:cursor-pointer hover:underline hover:underline-offset-4"
                  onClick={() => {
                    navigator.clipboard.writeText(user.email);
                    toast.success(m.admin_users_email_copied());
                  }}
                >
                  {user.emailVerified ? (
                    <IconMailCheck className="stroke-green-500 dark:stroke-green-400" />
                  ) : (
                    <IconMailQuestion className="stroke-red-500 dark:stroke-red-400" />
                  )}
                  {user.email}
                </Badge>
              </div>
            )}
          </div>
          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {m.admin_users_joined()}:
              </span>
              <span>
                {toDate(user.createdAt)
                  ? formatDate(toDate(user.createdAt)!)
                  : '-'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {m.admin_users_updated()}:
              </span>
              <span>
                {toDate(user.updatedAt)
                  ? formatDate(toDate(user.updatedAt)!)
                  : '-'}
              </span>
            </div>
          </div>
          <Separator />
          {error && <div className="text-sm text-destructive">{error}</div>}
          {user.banned ? (
            <div className="grid gap-4">
              {user.banReason && (
                <div>
                  {m.admin_users_ban_reason()}: {user.banReason}
                </div>
              )}
              <div>
                {m.admin_users_ban_expires()}:{' '}
                {user.banExpires && toDate(user.banExpires)
                  ? formatDate(toDate(user.banExpires)!)
                  : m.admin_users_ban_never()}
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="ban-reason">{m.admin_users_ban_reason()}</Label>
                <Textarea
                  id="ban-reason"
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder={m.admin_users_ban_reason_placeholder()}
                  required
                />
              </div>
              <div className="grid w-fit max-w-full gap-2">
                <Label>{m.admin_users_ban_expires()}</Label>
                <div className="w-fit rounded-lg border border-input bg-background">
                  <button
                    type="button"
                    onClick={() => setCalendarOpen((o) => !o)}
                    className={cn(
                      'flex h-9 w-full items-center justify-start gap-1.5 px-2.5 text-sm font-normal outline-none hover:bg-muted hover:text-foreground rounded-lg',
                      !banExpiresAt && 'text-muted-foreground'
                    )}
                  >
                    <IconCalendar className="size-4 shrink-0" />
                    {banExpiresAt ? (
                      formatDate(banExpiresAt)
                    ) : (
                      <span>{m.admin_users_ban_select_date()}</span>
                    )}
                  </button>
                  {calendarOpen && (
                    <div className="w-auto border-t border-input p-2">
                      <Calendar
                        mode="single"
                        selected={banExpiresAt}
                        onSelect={(date) => {
                          setBanExpiresAt(date);
                          setCalendarOpen(false);
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        <DrawerFooter className="flex flex-col gap-2">
          {user.banned ? (
            <Button
              variant="destructive"
              onClick={handleUnban}
              disabled={unbanUserMutation.isPending}
            >
              {unbanUserMutation.isPending && (
                <IconLoader2 className="mr-2 size-4 animate-spin" />
              )}
              {m.admin_users_unban_button()}
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={handleBan}
              disabled={banUserMutation.isPending || !banReason?.trim()}
            >
              {banUserMutation.isPending && (
                <IconLoader2 className="mr-2 size-4 animate-spin" />
              )}
              {m.admin_users_ban_button()}
            </Button>
          )}
          <DrawerClose asChild>
            <Button variant="outline">{m.admin_users_close()}</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
