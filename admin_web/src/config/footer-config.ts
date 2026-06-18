import { m } from '@/locale/paraglide/messages';
import { Routes } from '@/lib/routes';
import type { MenuItemConfig } from '../types';
import { websiteConfig } from './website';
import { DOWNLOAD_URL, REPO_URL } from './links';
/**
 * Footer links, grouped by section
 */
export function getFooterLinks(): MenuItemConfig[] {
  const productItems: MenuItemConfig[] = [];
  productItems.push({
    title: m.nav_features(),
    href: Routes.Features,
    external: false,
  });
  if (websiteConfig.payment?.enable) {
    productItems.push({
      title: m.nav_pricing(),
      href: Routes.Pricing,
      external: false,
    });
  }
  productItems.push({
    title: m.nav_faq(),
    href: Routes.Faqs,
    external: false,
  });
  const resourcesItems: MenuItemConfig[] = [
    { title: 'GitHub', href: REPO_URL, external: true },
    { title: m.home_hero_primary(), href: DOWNLOAD_URL, external: true },
  ];
  if (websiteConfig.blog?.enable) {
    resourcesItems.push({
      title: m.nav_blog(),
      href: Routes.Blog,
      external: false,
    });
  }
  const legalItems: MenuItemConfig[] = [
    {
      title: m.nav_cookie_policy_title(),
      href: Routes.CookiePolicy,
      external: false,
    },
    {
      title: m.nav_privacy_policy_title(),
      href: Routes.PrivacyPolicy,
      external: false,
    },
    {
      title: m.nav_terms_of_service_title(),
      href: Routes.TermsOfService,
      external: false,
    },
  ];
  return [
    { title: m.nav_product(), items: productItems },
    { title: m.nav_resources(), items: resourcesItems },
    { title: m.nav_legal(), items: legalItems },
  ];
}
