import { m } from '@/locale/paraglide/messages';
import { HeaderSection } from '@/components/shared/header-section';
import { ScrollReveal } from '@/components/shared/scroll-reveal';
import { IconDownload, IconLogin2, IconMessage2, IconSettings } from '@tabler/icons-react';
export default function Features2Section() {
  return (
    <section id="features2" className="px-4 py-16 md:py-24">
      <div className="mx-auto max-w-6xl space-y-8 px-2 lg:space-y-20 lg:px-0">
        <ScrollReveal>
          <HeaderSection
            title={m.home_features2_title()}
            subtitle={m.home_features2_subtitle()}
            description={m.home_features2_description()}
          />
        </ScrollReveal>

        <ScrollReveal delay={150}>
          <div className="grid items-center gap-12 lg:grid-cols-5 lg:gap-24">
            <div className="lg:col-span-2">
              <div className="lg:pr-0">
                <h2 className="text-4xl font-semibold">{m.home_features2_title()}</h2>
                <p className="text-muted-foreground mt-6">{m.home_features2_description()}</p>
              </div>

              <ul className="mt-8 divide-y border-y *:flex *:items-center *:gap-3 *:py-3">
                <li>
                  <IconDownload className="size-5 shrink-0" />
                  {m.home_features2_feature1()}
                </li>
                <li>
                  <IconLogin2 className="size-5 shrink-0" />
                  {m.home_features2_feature2()}
                </li>
                <li>
                  <IconSettings className="size-5 shrink-0" />
                  {m.home_features2_feature3()}
                </li>
                <li>
                  <IconMessage2 className="size-5 shrink-0" />
                  {m.home_features2_feature4()}
                </li>
              </ul>
            </div>

            <div className="border-border/50 relative rounded-3xl border p-3 lg:col-span-3">
              <div className="aspect-76/59 bg-linear-to-b relative rounded-2xl from-zinc-300 to-transparent p-px dark:from-zinc-700">
                <img
                  src="https://cdn.mksaas.com/blocks/dark-card.webp"
                  alt={m.block_features2_card_alt({ mode: 'dark' })}
                  className="hidden size-full rounded-[15px] object-cover dark:block"
                  loading="lazy"
                />
                <img
                  src="https://cdn.mksaas.com/blocks/card.png"
                  alt={m.block_features2_card_alt({ mode: 'light' })}
                  className="size-full rounded-[15px] object-cover shadow dark:hidden"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
