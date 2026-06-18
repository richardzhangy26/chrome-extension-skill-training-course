import { websiteConfig } from '@/config/website';
import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  const name = websiteConfig.metadata?.name ?? 'App';
  const logoLight = websiteConfig.metadata?.images?.logoLight ?? '/logo.png';
  const logoDark = websiteConfig.metadata?.images?.logoDark ?? logoLight;

  return (
    <>
      <img
        src={logoLight}
        alt={`${name} logo`}
        className={cn('size-8 rounded-md dark:hidden', className)}
        width={32}
        height={32}
        decoding="async"
      />
      <img
        src={logoDark}
        alt={`${name} logo`}
        className={cn('size-8 rounded-md hidden dark:block', className)}
        width={32}
        height={32}
        decoding="async"
      />
    </>
  );
}
