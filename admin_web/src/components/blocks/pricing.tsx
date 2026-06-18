import { m } from '@/locale/paraglide/messages';
import { HeaderSection } from '@/components/shared/header-section';
import { ScrollReveal } from '@/components/shared/scroll-reveal';
import { PricingTable } from '@/components/pricing/pricing-table';
export default function PricingSection() {
  return (
    <section id="pricing" className="px-4 py-16 md:py-24">
      <div className="mx-auto max-w-6xl space-y-16">
        <ScrollReveal>
          <HeaderSection
            subtitle={m.home_pricing_block_subtitle()}
            subtitleClassName="text-4xl font-bold"
            description={m.home_pricing_block_description()}
          />
        </ScrollReveal>
        <ScrollReveal delay={150}>
          <PricingTable />
        </ScrollReveal>
      </div>
    </section>
  );
}
