import { allPages } from 'content-collections';
import type { Page } from 'content-collections';
import { baseLocale, getLocale, type Locale } from '@/lib/locale';

export type PageDoc = Page & { locale: Locale; slug: string };

export function getPageBySlug(
  slug: string,
  locale: Locale = getLocale()
): PageDoc | undefined {
  const pages = allPages as PageDoc[];
  return (
    pages.find((p) => p.slug === slug && p.locale === locale) ??
    pages.find((p) => p.slug === slug && p.locale === baseLocale)
  );
}
