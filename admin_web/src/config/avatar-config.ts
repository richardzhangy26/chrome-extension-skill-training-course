import { m } from '@/locale/paraglide/messages';
import {
  IconCreditCard,
  IconLayoutDashboard,
  IconSettings2,
} from '@tabler/icons-react';
import { Routes } from '@/lib/routes';
import type { MenuItemConfig } from '../types';
import { websiteConfig } from './website';
/**
 * Avatar dropdown links
 */
export function getAvatarLinks(): MenuItemConfig[] {
  return [
    {
      title: m.dashboard_avatar_dashboard(),
      href: Routes.Dashboard,
      icon: IconLayoutDashboard,
    },
    ...(websiteConfig.payment?.enable
      ? [
          {
            title: m.dashboard_avatar_billing(),
            href: Routes.SettingsBilling,
            icon: IconCreditCard,
          },
        ]
      : []),
    {
      title: m.dashboard_avatar_settings(),
      href: Routes.SettingsProfile,
      icon: IconSettings2,
    },
  ];
}
