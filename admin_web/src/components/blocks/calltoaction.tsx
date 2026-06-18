import { m } from '@/locale/paraglide/messages';
import { ScrollReveal } from '@/components/shared/scroll-reveal';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Routes } from '@/lib/routes';
import { Link } from '@tanstack/react-router';
export default function CallToActionSection() {
  return (
    <section
      id="call-to-action"
      className="relative overflow-hidden px-4 py-16 md:py-24"
    >
      {/* Warm gradient background */}
      <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-muted/80 to-chart-1/8 dark:from-primary/8 dark:via-muted/50 dark:to-chart-1/5" />
      <div className="relative mx-auto max-w-5xl px-6">
        <ScrollReveal className="text-center">
          <h2 className="text-balance text-4xl font-semibold lg:text-5xl">
            {m.home_call_to_action_title()}
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">
            {m.home_call_to_action_description()}
          </p>

          <div className="mt-12 flex flex-wrap justify-center gap-4">
            <Link
              to={Routes.Login}
              className={cn(buttonVariants({ size: 'lg' }))}
            >
              <span>{m.home_call_to_action_primary_button()}</span>
            </Link>
            <Link
              to="/"
              hash="pricing"
              className={cn(buttonVariants({ size: 'lg', variant: 'outline' }))}
            >
              <span>{m.home_call_to_action_secondary_button()}</span>
            </Link>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
