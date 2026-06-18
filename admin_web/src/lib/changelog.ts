import { allChangelogs } from 'content-collections';
import type { Changelog } from 'content-collections';
import { getLocale, type Locale } from '@/lib/locale';

export type ChangelogRelease = Changelog & { locale: Locale; slug: string };

export function getChangelogReleases(
  locale: Locale = getLocale()
): ChangelogRelease[] {
  return [...(allChangelogs as ChangelogRelease[])]
    .filter((r) => r.published && r.locale === locale)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
