import { websiteConfig } from '@/config/website';
import {
  getCanonicalUrl,
  getCanonicalUrlForLocale,
  getOgImage,
  twitterHandleFromUrl,
} from '@/lib/urls';
import {
  baseLocale,
  getLocale,
  isLocalizedPath,
  localeConfig,
  locales,
} from '@/lib/locale';

/**
 * Build metadata + canonical link for a page
 * @param path - The path of the page
 * @param options - The options for the page
 * @returns The metadata and canonical link
 */
export function seo(
  path: string,
  options: {
    title: string;
    description?: string;
    keywords?: string;
    image?: string;
    type?: 'website' | 'article';
  }
) {
  const url = getCanonicalUrl(path);
  const image = options.image ?? getOgImage();
  const localized = isLocalizedPath(path);
  const alternateLinks = localized
    ? [
        ...locales.map((locale) => ({
          rel: 'alternate',
          hrefLang: localeConfig[locale].hreflang,
          href: getCanonicalUrlForLocale(path, locale),
        })),
        {
          rel: 'alternate',
          hrefLang: 'x-default',
          href: getCanonicalUrlForLocale(path, baseLocale),
        },
      ]
    : [];

  return {
    meta: metadata({ ...options, url, image, type: options.type ?? 'website' }),
    links: [{ rel: 'canonical', href: url }, ...alternateLinks],
  };
}

export const metadata = ({
  title,
  description,
  keywords,
  image,
  url,
  type = 'website',
}: {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  keywords?: string;
  type?: 'website' | 'article';
}) => {
  const twitterSite = websiteConfig.social?.twitter
    ? twitterHandleFromUrl(websiteConfig.social.twitter)
    : null;
  // OG locale format uses underscore (e.g. en_US, zh_CN), unlike BCP 47 used
  // for <html lang> / hreflang which uses hyphens.
  const currentLocale = getLocale();
  const ogLocale = localeConfig[currentLocale].hreflang.replace('-', '_');
  const alternateLocales = locales
    .filter((l) => l !== currentLocale)
    .map((l) => localeConfig[l].hreflang.replace('-', '_'));
  const metadata: Array<{
    title?: string;
    name?: string;
    property?: string;
    content?: string;
  }> = [
    { title },
    ...(description ? [{ name: 'description', content: description }] : []),
    ...(keywords ? [{ name: 'keywords', content: keywords }] : []),
    // OG metadata
    { property: 'og:type', content: type },
    { property: 'og:site_name', content: websiteConfig.metadata?.name ?? '' },
    { property: 'og:locale', content: ogLocale },
    ...alternateLocales.map((loc) => ({
      property: 'og:locale:alternate',
      content: loc,
    })),
    { property: 'og:title', content: title },
    ...(description
      ? [{ property: 'og:description', content: description }]
      : []),
    ...(url ? [{ property: 'og:url', content: url }] : []),
    ...(image ? [{ property: 'og:image', content: image }] : []),
    // Twitter metadata (twitter:site = site's @username, not domain)
    { name: 'twitter:title', content: title },
    ...(twitterSite ? [{ name: 'twitter:site', content: twitterSite }] : []),
    ...(description
      ? [{ name: 'twitter:description', content: description }]
      : []),
    ...(url ? [{ name: 'twitter:url', content: url }] : []),
    ...(image
      ? [
          { name: 'twitter:card', content: 'summary_large_image' as const },
          { name: 'twitter:image', content: image },
        ]
      : []),
  ];
  return metadata;
};
