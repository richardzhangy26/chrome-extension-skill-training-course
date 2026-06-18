import { m } from '@/locale/paraglide/messages';
import { websiteConfig } from '@/config/website';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { IconDeviceDesktop, IconMoon, IconSun } from '@tabler/icons-react';
import { useTheme } from '@/components/theme/theme-provider';
/**
 * Theme mode switcher (light / dark / system), used in navbar.
 */
export function ModeSwitcher() {
  if (!websiteConfig.ui?.mode?.enableSwitch) {
    return null;
  }
  const { setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-transparent p-0 hover:bg-accent"
        aria-label={m.common_toggle_theme()}
      >
        <span className="relative inline-flex size-4 items-center justify-center">
          <IconSun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <IconMoon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
