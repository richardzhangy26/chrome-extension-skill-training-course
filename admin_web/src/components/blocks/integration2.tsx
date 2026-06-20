import type { ReactNode } from 'react';

import { MODEL_BRAND_ICONS } from '@/components/blocks/model-brand-icons';
import { Logo } from '@/components/shared/logo';
import { ScrollReveal } from '@/components/shared/scroll-reveal';
import { buttonVariants } from '@/components/ui/button';
import { DOWNLOAD_URL, REPO_URL } from '@/config/links';
import { m } from '@/locale/paraglide/messages';
import { cn } from '@/lib/utils';

const IntegrationCard = ({
  children,
  className,
  borderClassName,
}: {
  children: ReactNode;
  className?: string;
  borderClassName?: string;
}) => {
  return (
    <div
      className={cn(
        'bg-muted dark:bg-muted/50 hover:bg-accent dark:hover:bg-muted relative flex size-20 rounded-xl transition-colors duration-200',
        className,
      )}>
      <div role="presentation" className={cn('absolute inset-0 rounded-xl border', borderClassName)} />
      <div className="relative z-20 m-auto flex size-fit items-center justify-center *:size-8">{children}</div>
    </div>
  );
};

const Integration2Section = () => {
  const [doubao, openai, gemini, claude, qwen, wenxin] = MODEL_BRAND_ICONS;
  const renderModelIcon = ({ Icon, iconClassName }: (typeof MODEL_BRAND_ICONS)[number]) => (
    <Icon aria-hidden="true" className={cn('size-8', iconClassName)} size={32} />
  );

  return (
    <section>
      <div className="relative overflow-hidden py-16 md:py-24">
        <div className="bg-linear-to-tl from-primary/5 via-muted/70 to-chart-1/6 dark:from-primary/6 dark:via-muted/40 dark:to-chart-1/4 absolute inset-0" />
        <div className="relative mx-auto max-w-5xl px-6">
          <div className="grid items-center gap-8 sm:grid-cols-2 sm:gap-0">
            <ScrollReveal className="relative mx-auto w-fit">
              <div className="mx-auto mb-2 flex w-fit justify-center gap-2">
                <IntegrationCard>{renderModelIcon(doubao)}</IntegrationCard>
                <IntegrationCard>{renderModelIcon(openai)}</IntegrationCard>
              </div>
              <div className="mx-auto my-2 flex w-fit justify-center gap-2">
                <IntegrationCard>{renderModelIcon(gemini)}</IntegrationCard>
                <IntegrationCard borderClassName="border-black/25 dark:border-white/25" className="dark:bg-muted">
                  <Logo />
                </IntegrationCard>
                <IntegrationCard>{renderModelIcon(claude)}</IntegrationCard>
              </div>
              <div className="mx-auto flex w-fit justify-center gap-2">
                <IntegrationCard>{renderModelIcon(qwen)}</IntegrationCard>
                <IntegrationCard>{renderModelIcon(wenxin)}</IntegrationCard>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={200} className="mx-auto max-w-lg space-y-6 text-center sm:text-left">
              <h2 className="text-balance text-3xl font-semibold md:text-4xl">{m.home_integration2_title()}</h2>
              <p className="text-muted-foreground">{m.home_integration2_description()}</p>

              <div className="mt-12 flex flex-wrap justify-center gap-4 md:justify-start">
                <a
                  href={DOWNLOAD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ size: 'lg' }))}>
                  <span>{m.home_integration2_primary_button()}</span>
                </a>
                <a
                  href={REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ size: 'lg', variant: 'outline' }))}>
                  <span>{m.home_integration2_secondary_button()}</span>
                </a>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Integration2Section;
