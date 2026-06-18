import { m } from '@/locale/paraglide/messages';
import { Routes } from '@/lib/routes';
import type { MenuItemConfig } from '../types';
import { websiteConfig } from './website';
import { REPO_URL } from './links';
/**
 * Navbar links
 */
export function getNavbarLinks(): MenuItemConfig[] {
  const links: MenuItemConfig[] = [{ title: m.nav_features(), href: Routes.Features, external: false }];
  if (websiteConfig.payment?.enable) {
    links.push({
      title: m.nav_pricing(),
      href: Routes.Pricing,
      external: false,
    });
  }
  if (websiteConfig.blog?.enable) {
    links.push({ title: m.nav_blog(), href: Routes.Blog, external: false });
  }
  links.push({ title: 'GitHub', href: REPO_URL, external: true });
  return links;
}
