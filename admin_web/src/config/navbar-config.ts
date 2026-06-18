import { m } from '@/locale/paraglide/messages';
import { Routes } from '@/lib/routes';
import {
  IconBuilding,
  IconBulb,
  IconCookie,
  IconFileText,
  IconLanguage,
  IconListCheck,
  IconMail,
  IconMailbox,
  IconMicrophone,
  IconPhoto,
  IconPhotoEdit,
  IconPhotoScan,
  IconRoute,
  IconShieldCheck,
  IconSparkles,
  IconWand,
} from '@tabler/icons-react';
import type { MenuItemConfig } from '../types';
import { websiteConfig } from './website';
/**
 * Navbar links
 */
export function getNavbarLinks(): MenuItemConfig[] {
  const links: MenuItemConfig[] = [
    { title: m.nav_features(), href: Routes.Features, external: false },
  ];
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
  links.push({
    title: m.nav_ai_title(),
    items: [
      {
        title: m.nav_ai_summarization_title(),
        description: m.nav_ai_summarization_description(),
        href: Routes.AiSummarization,
        icon: IconWand,
        external: false,
      },
      {
        title: m.nav_ai_translation_title(),
        description: m.nav_ai_translation_description(),
        href: Routes.AiTranslation,
        icon: IconLanguage,
        external: false,
      },
      {
        title: m.nav_ai_tagline_title(),
        description: m.nav_ai_tagline_description(),
        href: Routes.AiTagline,
        icon: IconBulb,
        external: false,
      },
      {
        title: m.nav_ai_tts_title(),
        description: m.nav_ai_tts_description(),
        href: Routes.AiTts,
        icon: IconMicrophone,
        external: false,
      },
      {
        title: m.nav_ai_caption_title(),
        description: m.nav_ai_caption_description(),
        href: Routes.AiCaption,
        icon: IconPhotoScan,
        external: false,
      },
      {
        title: m.nav_ai_image_cf_title(),
        description: m.nav_ai_image_cf_description(),
        href: Routes.AiImageCf,
        icon: IconSparkles,
        external: false,
      },
      {
        title: m.nav_ai_image_fal_title(),
        description: m.nav_ai_image_fal_description(),
        href: Routes.AiImageFal,
        icon: IconPhoto,
        external: false,
      },
      {
        title: m.nav_ai_image_edit_title(),
        description: m.nav_ai_image_edit_description(),
        href: Routes.AiImageEdit,
        icon: IconPhotoEdit,
        external: false,
      },
    ],
  });
  links.push({
    title: m.nav_pages(),
    items: [
      {
        title: m.nav_about_title(),
        description: m.nav_about_description(),
        href: Routes.About,
        icon: IconBuilding,
        external: false,
      },
      {
        title: m.nav_contact_title(),
        description: m.nav_contact_description(),
        href: Routes.Contact,
        icon: IconMail,
        external: false,
      },
      {
        title: m.nav_waitlist_title(),
        description: m.nav_waitlist_description(),
        href: Routes.Waitlist,
        icon: IconMailbox,
        external: false,
      },
      {
        title: m.nav_changelog_title(),
        description: m.nav_changelog_description(),
        href: Routes.Changelog,
        icon: IconListCheck,
        external: false,
      },
      {
        title: m.nav_roadmap_title(),
        description: m.nav_roadmap_description(),
        href: Routes.Roadmap,
        icon: IconRoute,
        external: false,
      },
      {
        title: m.nav_cookie_policy_title(),
        description: m.nav_cookie_policy_description(),
        href: Routes.CookiePolicy,
        icon: IconCookie,
        external: false,
      },
      {
        title: m.nav_privacy_policy_title(),
        description: m.nav_privacy_policy_description(),
        href: Routes.PrivacyPolicy,
        icon: IconShieldCheck,
        external: false,
      },
      {
        title: m.nav_terms_of_service_title(),
        description: m.nav_terms_of_service_description(),
        href: Routes.TermsOfService,
        icon: IconFileText,
        external: false,
      },
    ],
  });
  return links;
}
