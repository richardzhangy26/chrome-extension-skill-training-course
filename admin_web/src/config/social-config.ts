import { getMailtoUrl } from '@/lib/urls';
import type { MenuItemConfig } from '@/types';
import {
  IconBrandBluesky,
  IconBrandDiscordFilled,
  IconBrandFacebook,
  IconBrandGithubFilled,
  IconBrandInstagram,
  IconBrandLinkedin,
  IconBrandMastodon,
  IconBrandTelegram,
  IconBrandTiktokFilled,
  IconBrandXFilled,
  IconBrandYoutubeFilled,
  IconMailFilled,
} from '@tabler/icons-react';
import { websiteConfig } from './website';

/**
 * Social links as menu items (title, href, icon). Uses MenuItemConfig.
 */
export function getSocialLinks(): MenuItemConfig[] {
  const social: MenuItemConfig[] = [];
  const config = websiteConfig.social;

  if (config?.github) {
    social.push({
      title: 'GitHub',
      href: config.github,
      icon: IconBrandGithubFilled,
      external: true,
    });
  }
  if (config?.twitter) {
    social.push({
      title: 'Twitter',
      href: config.twitter,
      icon: IconBrandXFilled,
      external: true,
    });
  }
  if (config?.blueSky) {
    social.push({
      title: 'Bluesky',
      href: config.blueSky,
      icon: IconBrandBluesky,
      external: true,
    });
  }
  if (config?.mastodon) {
    social.push({
      title: 'Mastodon',
      href: config.mastodon,
      icon: IconBrandMastodon,
      external: true,
    });
  }
  if (config?.discord) {
    social.push({
      title: 'Discord',
      href: config.discord,
      icon: IconBrandDiscordFilled,
      external: true,
    });
  }
  if (config?.youtube) {
    social.push({
      title: 'YouTube',
      href: config.youtube,
      icon: IconBrandYoutubeFilled,
      external: true,
    });
  }
  if (config?.linkedin) {
    social.push({
      title: 'LinkedIn',
      href: config.linkedin,
      icon: IconBrandLinkedin,
      external: true,
    });
  }
  if (config?.facebook) {
    social.push({
      title: 'Facebook',
      href: config.facebook,
      icon: IconBrandFacebook,
      external: true,
    });
  }
  if (config?.instagram) {
    social.push({
      title: 'Instagram',
      href: config.instagram,
      icon: IconBrandInstagram,
      external: true,
    });
  }
  if (config?.tiktok) {
    social.push({
      title: 'TikTok',
      href: config.tiktok,
      icon: IconBrandTiktokFilled,
      external: true,
    });
  }
  if (config?.telegram) {
    social.push({
      title: 'Telegram',
      href: config.telegram,
      icon: IconBrandTelegram,
      external: true,
    });
  }
  const supportEmail = getMailtoUrl(websiteConfig.mail?.supportEmail);
  if (supportEmail) {
    social.push({
      title: 'Email',
      href: supportEmail,
      icon: IconMailFilled,
      external: true,
    });
  }
  return social;
}
