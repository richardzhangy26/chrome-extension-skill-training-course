import { clientEnv } from '@/env/client';
import { websiteConfig } from '@/config/website';
import {
  deLocalizeHref,
  getLocale,
  localizeHref,
  type Locale,
} from '@/lib/locale';

/**
 * Site origin (build-time). Safe to call from both client and server:
 * Vite inlines import.meta.env at build time, so server bundle gets the same value.
 */
export function getBaseUrl(): string {
  return clientEnv.VITE_BASE_URL;
}

/**
 * Build canonical URL for a path (e.g. /about -> https://example.com/about)
 * @param path - The path to build the canonical URL for
 * @returns The canonical URL
 */
export function getCanonicalUrl(path: string): string {
  const base = getBaseUrl().replace(/\/$/, '');
  const rawPath = path.startsWith('/') ? path : `/${path}`;
  const p = localizeHref(rawPath, { locale: getLocale() });
  return `${base}${p}`;
}

export function getCanonicalUrlForLocale(path: string, locale: Locale): string {
  const base = getBaseUrl().replace(/\/$/, '');
  const rawPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${localizeHref(rawPath, { locale })}`;
}

/**
 * Get the path with the current or provided locale applied.
 * e.g. getPathWithLocale('/dashboard', 'zh') => '/zh/dashboard'
 * e.g. getPathWithLocale('/dashboard', 'en') => '/dashboard'
 */
export function getPathWithLocale(
  path: string,
  locale: Locale = getLocale()
): string {
  return localizeHref(deLocalizeHref(path), { locale });
}

/**
 * Get the URL of the image, if the image is a relative path, it will be prefixed with the base URL
 * @param image - The image URL
 * @returns The URL of the image
 */
export function getImageUrl(image: string): string {
  if (image.startsWith('http://') || image.startsWith('https://')) {
    return image;
  }
  if (image.startsWith('/')) {
    return `${getBaseUrl()}${image}`;
  }
  return `${getBaseUrl()}/${image}`;
}

/**
 * OG image absolute URL from website config.
 */
export function getOgImage(): string | undefined {
  const path = websiteConfig.metadata?.images?.ogImage;
  return path ? getImageUrl(path) : undefined;
}

/**
 * Get the Stripe customer dashboard URL
 * @param customerId - The Stripe customer ID
 * @returns The Stripe customer dashboard URL
 */
export function getStripeCustomerDashboardUrl(customerId: string): string {
  if (import.meta.env.DEV) {
    return `https://dashboard.stripe.com/test/customers/${customerId}`;
  }
  return `https://dashboard.stripe.com/customers/${customerId}`;
}

/**
 * Get the access URL for a file stored in R2
 * @param r2Key - The R2 storage key
 * @returns The file access URL
 */
export function getFileAccessUrl(r2Key: string): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/api/storage/file?key=${encodeURIComponent(r2Key)}`;
}

/**
 * Convert email string to mailto href. Supports "Name <email>" format.
 * @param email - Plain email or "Display Name <email>"
 * @returns mailto href, or undefined if email is empty
 */
export function getMailtoUrl(
  email: string | undefined | null
): string | undefined {
  if (!email?.trim()) return undefined;
  const trimmed = email.trim();
  return trimmed.includes('<')
    ? trimmed.replace(/^[^<]*<([^>]*)>.*$/, 'mailto:$1')
    : `mailto:${trimmed}`;
}

/**
 * Extract @handle from twitter/x profile URL, e.g. https://twitter.com/Me -> @Me
 */
export function twitterHandleFromUrl(href: string): string | null {
  try {
    const u = new URL(href);
    if (u.hostname !== 'twitter.com' && u.hostname !== 'x.com') return null;
    const segment = u.pathname.replace(/^\/+|\/+$/g, '').split('/')[0];
    return segment ? `@${segment}` : null;
  } catch {
    return null;
  }
}

/**
 * Whether the current pathname exactly matches the given link.
 * Anchor links (e.g. /#features) are never considered active when only pathname
 * is compared, so the homepage root does not highlight "Features" / "Faqs" etc.
 */
export function isLinkActive(
  href: string | undefined,
  pathname: string
): boolean {
  if (!href) return false;
  if (href.includes('#')) return false;
  const path = href.split('#')[0] ?? '/';
  const normalizedHref = path === '/' ? '/' : path.replace(/\/$/, '') || '/';
  const normalizedPath =
    pathname === '/' ? '/' : pathname.replace(/\/$/, '') || '/';
  return normalizedPath === normalizedHref;
}
