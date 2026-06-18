import { m } from '@/locale/paraglide/messages';
import { Link } from '@tanstack/react-router';
import { Logo } from '@/components/shared/logo';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
/**
 * Not found component for TanStack Router
 * https://github.com/TanStack/router/blob/main/examples/react/start-basic-cloudflare/src/components/NotFound.tsx
 */
export function DefaultNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-8 px-4">
      <Logo className="size-12" />
      <h1 className="text-4xl font-bold">{m.not_found_title()}</h1>
      <p className="text-balance text-center text-xl font-medium text-muted-foreground">
        {m.not_found_description()}
      </p>
      <Link
        to="/"
        className={cn(buttonVariants({ size: 'lg', variant: 'default' }))}
      >
        {m.not_found_back_to_home()}
      </Link>
    </div>
  );
}
