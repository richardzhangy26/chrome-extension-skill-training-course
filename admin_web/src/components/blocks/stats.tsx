import { m } from '@/locale/paraglide/messages';
import { HeaderSection } from '@/components/shared/header-section';
import { ScrollReveal } from '@/components/shared/scroll-reveal';
export default function StatsSection() {
  return (
    <section id="stats" className="px-4 py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-6 space-y-8 md:space-y-16">
        <ScrollReveal>
          <HeaderSection
            title={m.home_stats_title()}
            subtitle={m.home_stats_subtitle()}
            description={m.home_stats_description()}
          />
        </ScrollReveal>

        <div className="grid gap-2 *:text-center md:grid-cols-3 md:divide-x md:divide-border">
          <ScrollReveal delay={0} className="space-y-4 py-4 md:py-0">
            <div className="text-5xl font-bold tabular-nums text-primary">
              +1200
            </div>
            <p className="text-muted-foreground font-medium">
              {m.home_stats_items_item_1_title()}
            </p>
          </ScrollReveal>
          <ScrollReveal delay={120} className="space-y-4 py-4 md:py-0">
            <div className="text-5xl font-bold tabular-nums text-primary">
              22 Million
            </div>
            <p className="text-muted-foreground font-medium">
              {m.home_stats_items_item_2_title()}
            </p>
          </ScrollReveal>
          <ScrollReveal delay={240} className="space-y-4 py-4 md:py-0">
            <div className="text-5xl font-bold tabular-nums text-primary">
              +500
            </div>
            <p className="text-muted-foreground font-medium">
              {m.home_stats_items_item_3_title()}
            </p>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
