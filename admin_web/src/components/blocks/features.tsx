import { m } from '@/locale/paraglide/messages';
import { HeaderSection } from '@/components/shared/header-section';
import { ScrollReveal } from '@/components/shared/scroll-reveal';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import type { Icon } from '@tabler/icons-react';
import {
  IconChartBar,
  IconDatabase,
  IconFingerprint,
  IconId,
} from '@tabler/icons-react';
import { useState } from 'react';
type ImageKey = 'item-1' | 'item-2' | 'item-3' | 'item-4';
const icons: Record<ImageKey, Icon> = {
  'item-1': IconDatabase,
  'item-2': IconFingerprint,
  'item-3': IconId,
  'item-4': IconChartBar,
};
const images: Record<
  ImageKey,
  {
    image: string;
    darkImage: string;
    alt: string;
  }
> = {
  'item-1': {
    image: 'https://cdn.mksaas.com/blocks/charts-light.png',
    darkImage: 'https://cdn.mksaas.com/blocks/charts.png',
    alt: 'Product Feature One',
  },
  'item-2': {
    image: 'https://cdn.mksaas.com/blocks/music-light.png',
    darkImage: 'https://cdn.mksaas.com/blocks/music.png',
    alt: 'Product Feature Two',
  },
  'item-3': {
    image: 'https://cdn.mksaas.com/blocks/mail2-light.png',
    darkImage: 'https://cdn.mksaas.com/blocks/mail2.png',
    alt: 'Product Feature Three',
  },
  'item-4': {
    image: 'https://cdn.mksaas.com/blocks/payments-light.png',
    darkImage: 'https://cdn.mksaas.com/blocks/payments.png',
    alt: 'Product Feature Four',
  },
};
export default function FeaturesSection() {
  const [activeItem, setActiveItem] = useState<ImageKey>('item-1');
  const featureItems = [
    {
      key: 'item-1' as const,
      title: m.home_features_items_item_1_title(),
      description: m.home_features_items_item_1_description(),
    },
    {
      key: 'item-2' as const,
      title: m.home_features_items_item_2_title(),
      description: m.home_features_items_item_2_description(),
    },
    {
      key: 'item-3' as const,
      title: m.home_features_items_item_3_title(),
      description: m.home_features_items_item_3_description(),
    },
    {
      key: 'item-4' as const,
      title: m.home_features_items_item_4_title(),
      description: m.home_features_items_item_4_description(),
    },
  ];
  return (
    <section id="features" className="px-4 py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-2 lg:px-0 space-y-8 lg:space-y-20 dark:[--color-border:color-mix(in_oklab,var(--color-white)_10%,transparent)]">
        <ScrollReveal>
          <HeaderSection
            title={m.home_features_title()}
            subtitle={m.home_features_subtitle()}
            description={m.home_features_description()}
          />
        </ScrollReveal>

        <ScrollReveal delay={150}>
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-24">
            <div className="flex flex-col gap-8 lg:col-span-5">
              <div className="text-left lg:pr-0">
                <h3 className="py-1 text-3xl font-semibold leading-normal text-foreground lg:text-4xl">
                  {m.home_features_title()}
                </h3>
                <p className="mt-4 text-muted-foreground">
                  {m.home_features_description()}
                </p>
              </div>
              <Accordion
                value={[activeItem]}
                onValueChange={(v) =>
                  setActiveItem((v?.[0] as ImageKey) ?? 'item-1')
                }
                className="w-full"
              >
                {featureItems.map((item) => {
                  const ItemIcon = icons[item.key];
                  return (
                    <AccordionItem key={item.key} value={item.key}>
                      <AccordionTrigger>
                        <div className="flex items-center gap-2 text-base">
                          <ItemIcon className="size-4" />
                          {item.title}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        {item.description}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>

            <div className="relative flex w-full overflow-hidden rounded-2xl border bg-background p-2 lg:col-span-7 lg:h-auto">
              <div className="relative w-full rounded-2xl aspect-76/59 bg-background">
                <div
                  key={activeItem}
                  className="animate-crossfade-in size-full overflow-hidden rounded-2xl border bg-muted shadow-md"
                >
                  <img
                    src={images[activeItem].image}
                    alt={images[activeItem].alt}
                    loading="lazy"
                    className="size-full object-cover object-top-left rounded-2xl dark:hidden"
                  />
                  <img
                    src={images[activeItem].darkImage}
                    alt={images[activeItem].alt}
                    loading="lazy"
                    className="hidden size-full object-cover object-top-left rounded-2xl dark:block"
                  />
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
