import { m } from '@/locale/paraglide/messages';
import { HeaderSection } from '@/components/shared/header-section';
import { ScrollReveal } from '@/components/shared/scroll-reveal';
export default function StatsSection() {
  return (
    <section id="stats" className="px-4 py-16 md:py-24">
      <div className="mx-auto max-w-5xl space-y-8 px-6 md:space-y-16">
        <ScrollReveal>
          <HeaderSection
            title={m.home_stats_title()}
            subtitle={m.home_stats_subtitle()}
            description={m.home_stats_description()}
          />
        </ScrollReveal>

        <div className="md:divide-border grid gap-2 *:text-center md:grid-cols-3 md:divide-x">
          <ScrollReveal delay={0} className="space-y-4 py-4 md:py-0">
            <div className="text-primary text-5xl font-bold tabular-nums">6+</div>
            <p className="text-muted-foreground font-medium">{m.home_stats_items_item_1_title()}</p>
          </ScrollReveal>
          <ScrollReveal delay={120} className="space-y-4 py-4 md:py-0">
            <div className="text-primary text-5xl font-bold tabular-nums">3</div>
            <p className="text-muted-foreground font-medium">{m.home_stats_items_item_2_title()}</p>
          </ScrollReveal>
          <ScrollReveal delay={240} className="space-y-4 py-4 md:py-0">
            <div className="text-primary text-5xl font-bold tabular-nums">3</div>
            <p className="text-muted-foreground font-medium">{m.home_stats_items_item_3_title()}</p>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
