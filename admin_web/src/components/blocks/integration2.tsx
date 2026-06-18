import { m } from '@/locale/paraglide/messages';
import { Logo } from '@/components/shared/logo';
import { ScrollReveal } from '@/components/shared/scroll-reveal';
import { buttonVariants } from '@/components/ui/button';
import { Link } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import {
  IconBrandCodesandbox,
  IconBrandGoogleFilled,
  IconBrandOpenai,
  IconBrandReact,
  IconBrandVisualStudio,
  IconBrandWikipedia,
} from '@tabler/icons-react';
import { BRAND_COLORS } from '@/components/blocks/integration';
const BRAND_ICONS = [
  { Icon: IconBrandOpenai, color: BRAND_COLORS.openai },
  { Icon: IconBrandCodesandbox, color: BRAND_COLORS.codesandbox },
  { Icon: IconBrandReact, color: BRAND_COLORS.react },
  { Icon: IconBrandVisualStudio, color: BRAND_COLORS.vs },
  { Icon: IconBrandWikipedia, color: BRAND_COLORS.wikipedia },
  { Icon: IconBrandGoogleFilled, color: BRAND_COLORS.google },
];
function IntegrationCard({
  children,
  className,
  borderClassName,
}: {
  children: React.ReactNode;
  className?: string;
  borderClassName?: string;
}) {
  return (
    <div
      className={cn(
        'relative flex size-20 rounded-xl bg-muted dark:bg-muted/50 transition-colors duration-200 hover:bg-accent dark:hover:bg-muted',
        className
      )}
    >
      <div
        role="presentation"
        className={cn('absolute inset-0 rounded-xl border', borderClassName)}
      />
      <div className="relative z-20 m-auto size-fit *:size-8 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}
export default function Integration2Section() {
  const [b0, b1, b2, b3, b4, b5] = BRAND_ICONS;
  return (
    <section>
      <div className="relative overflow-hidden py-16 md:py-24">
        <div className="absolute inset-0 bg-linear-to-tl from-primary/5 via-muted/70 to-chart-1/6 dark:from-primary/6 dark:via-muted/40 dark:to-chart-1/4" />
        <div className="relative mx-auto max-w-5xl px-6">
          <div className="grid items-center gap-8 sm:grid-cols-2 sm:gap-0">
            <ScrollReveal className="relative mx-auto w-fit">
              <div className="mx-auto mb-2 flex w-fit justify-center gap-2">
                <IntegrationCard>
                  <b0.Icon className="size-8" style={{ color: b0.color }} />
                </IntegrationCard>
                <IntegrationCard>
                  <b1.Icon className="size-8" style={{ color: b1.color }} />
                </IntegrationCard>
              </div>
              <div className="mx-auto my-2 flex w-fit justify-center gap-2">
                <IntegrationCard>
                  <b2.Icon className="size-8" style={{ color: b2.color }} />
                </IntegrationCard>
                <IntegrationCard
                  borderClassName="border-black/25 dark:border-white/25"
                  className="dark:bg-muted"
                >
                  <Logo />
                </IntegrationCard>
                <IntegrationCard>
                  <b3.Icon className="size-8" style={{ color: b3.color }} />
                </IntegrationCard>
              </div>
              <div className="mx-auto flex w-fit justify-center gap-2">
                <IntegrationCard>
                  <b4.Icon className="size-8" style={{ color: b4.color }} />
                </IntegrationCard>
                <IntegrationCard>
                  <b5.Icon className="size-8" style={{ color: b5.color }} />
                </IntegrationCard>
              </div>
            </ScrollReveal>
            <ScrollReveal
              delay={200}
              className="mx-auto max-w-lg space-y-6 text-center sm:text-left"
            >
              <h2 className="text-balance text-3xl font-semibold md:text-4xl">
                {m.home_integration2_title()}
              </h2>
              <p className="text-muted-foreground">
                {m.home_integration2_description()}
              </p>

              <div className="mt-12 flex flex-wrap justify-center gap-4 md:justify-start">
                <Link
                  to="/auth/login"
                  className={cn(buttonVariants({ size: 'lg' }))}
                >
                  <span>{m.home_integration2_primary_button()}</span>
                </Link>
                <Link
                  to="/"
                  hash="pricing"
                  className={cn(
                    buttonVariants({ size: 'lg', variant: 'outline' })
                  )}
                >
                  <span>{m.home_integration2_secondary_button()}</span>
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </section>
  );
}
