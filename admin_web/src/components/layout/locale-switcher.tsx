import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  deLocalizeHref,
  getLocale,
  localeConfig,
  locales,
  localizeHref,
  type Locale,
} from '@/lib/locale';
import { cn } from '@/lib/utils';
import { m } from '@/locale/paraglide/messages';
import { setLocale } from '@/locale/paraglide/runtime';
import { IconLanguage } from '@tabler/icons-react';
import { useLocation } from '@tanstack/react-router';

type LocaleSwitcherProps = {
  className?: string;
  onLocaleChange?: () => void;
};

type UseLocaleSwitcherOptions = {
  onLocaleChange?: () => void;
};

function withUrlPartPrefix(value: string | undefined, prefix: '?' | '#') {
  if (!value) {
    return '';
  }

  return value.startsWith(prefix) ? value : `${prefix}${value}`;
}

export function useLocaleSwitcher({
  onLocaleChange,
}: UseLocaleSwitcherOptions = {}) {
  const location = useLocation();
  const currentLocale = getLocale();
  const currentHref = [
    location.pathname,
    withUrlPartPrefix(location.searchStr, '?'),
    withUrlPartPrefix(location.hash, '#'),
  ].join('');
  const baseHref = deLocalizeHref(currentHref);

  function switchLocale(nextLocale: Locale) {
    if (nextLocale === currentLocale) {
      return;
    }

    const nextHref = localizeHref(baseHref, { locale: nextLocale });
    setLocale(nextLocale, { reload: false });
    onLocaleChange?.();
    window.location.assign(nextHref);
  }

  return { currentLocale, switchLocale };
}

export function LocaleSwitcher({
  className,
  onLocaleChange,
}: LocaleSwitcherProps) {
  const { currentLocale, switchLocale } = useLocaleSwitcher({
    onLocaleChange,
  });

  if (locales.length <= 1) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-transparent p-0 hover:bg-accent',
          className
        )}
        aria-label={m.common_switch_language()}
      >
        <IconLanguage className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((locale) => (
          <DropdownMenuItem
            key={locale}
            onClick={() => switchLocale(locale)}
            disabled={locale === currentLocale}
          >
            {localeConfig[locale].flag ? (
              <span className="mr-2 text-base">
                {localeConfig[locale].flag}
              </span>
            ) : null}
            <span>{localeConfig[locale].name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
