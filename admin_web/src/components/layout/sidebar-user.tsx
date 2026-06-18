import { m } from '@/locale/paraglide/messages';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { websiteConfig } from '@/config/website';
import type { SessionUser } from '@/auth/types';
import { localeConfig, locales, type Locale } from '@/lib/locale';
import { useLocaleSwitcher } from '@/components/layout/locale-switcher';
import {
  IconDeviceDesktop,
  IconLanguage,
  IconLogout,
  IconMoon,
  IconSelector,
  IconSun,
} from '@tabler/icons-react';
import { useState } from 'react';
import { useTheme } from '@/components/theme/theme-provider';
import { UserAvatar } from '@/components/shared/user-avatar';
import { authClient } from '@/auth/client';
import { useRouter } from '@tanstack/react-router';
import { toast } from 'sonner';
interface SidebarUserProps {
  user: SessionUser;
  className?: string;
}
export function SidebarUser({ user }: SidebarUserProps) {
  const router = useRouter();
  const { setTheme, theme } = useTheme();
  const { isMobile } = useSidebar();
  const [open, setOpen] = useState(false);
  const { currentLocale, switchLocale } = useLocaleSwitcher({
    onLocaleChange: () => setOpen(false),
  });
  const showModeSwitch = websiteConfig.ui?.mode?.enableSwitch ?? false;
  const showLocaleSwitch = locales.length > 1;
  const ThemeIcon =
    theme === 'system'
      ? IconDeviceDesktop
      : theme === 'dark'
        ? IconMoon
        : IconSun;
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
    <SidebarMenu className="border-t pt-4">
      <SidebarMenuItem>
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="bg-sidebar-accent/60 text-sidebar-accent-foreground hover:bg-sidebar-accent data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <UserAvatar
                  name={user.name ?? null}
                  image={user.image ?? null}
                  className="size-8 border"
                />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </div>
                <IconSelector className="ml-auto size-4" />
              </SidebarMenuButton>
            }
          />
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <UserAvatar
                    name={user.name ?? null}
                    image={user.image ?? null}
                    className="size-8 border"
                  />
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold text-foreground">
                      {user.name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>

              {showModeSwitch && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <ThemeIcon className="mr-2 size-4" />
                      {m.common_mode_theme()}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem onClick={() => setTheme('light')}>
                        <IconSun className="mr-2 size-4" />
                        {m.common_mode_light()}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme('dark')}>
                        <IconMoon className="mr-2 size-4" />
                        {m.common_mode_dark()}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme('system')}>
                        <IconDeviceDesktop className="mr-2 size-4" />
                        {m.common_mode_system()}
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </>
              )}

              {showLocaleSwitch && (
                <>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <IconLanguage className="mr-2 size-4" />
                      {m.common_switch_language()}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {locales.map((locale: Locale) => (
                        <DropdownMenuItem
                          key={locale}
                          onClick={() => switchLocale(locale)}
                          disabled={locale === currentLocale}
                        >
                          {localeConfig[locale].flag ? (
                            <span className="mr-2 text-base">
                              {localeConfig[locale].flag}
                            </span>
                          ) : null}
                          <span>{localeConfig[locale].name}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </>
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
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
