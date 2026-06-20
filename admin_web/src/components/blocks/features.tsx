import { m } from '@/locale/paraglide/messages';
import { HeaderSection } from '@/components/shared/header-section';
import { ScrollReveal } from '@/components/shared/scroll-reveal';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { Icon } from '@tabler/icons-react';
import { IconDatabase, IconHistory, IconMessageChatbot, IconScan, IconUsersGroup } from '@tabler/icons-react';
import { useState } from 'react';
type ImageKey = 'item-1' | 'item-2' | 'item-3' | 'item-4' | 'item-5';
const icons: Record<ImageKey, Icon> = {
  'item-1': IconScan,
  'item-2': IconMessageChatbot,
  'item-3': IconUsersGroup,
  'item-4': IconHistory,
  'item-5': IconDatabase,
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
    image: '/features/task-detection-light.png',
    darkImage: '/features/task-detection-dark.png',
    alt: '自动识别训练任务界面',
  },
  'item-2': {
    image: '/features/model-dialogue-light.png',
    darkImage: '/features/model-dialogue-dark.png',
    alt: '多模型对话生成配置界面',
  },
  'item-3': {
    image: '/features/multi-role-light.png',
    darkImage: '/features/multi-role-dark.png',
    alt: '多角色学生并行模拟界面',
  },
  'item-4': {
    image: '/features/conversation-history-light.png',
    darkImage: '/features/conversation-history-dark.png',
    alt: '训练对话历史记录与复盘界面',
  },
  'item-5': {
    image: '/features/conversation-simulation-light.png',
    darkImage: '/features/conversation-simulation-dark.png',
    alt: '对话记录模拟和知识库配置界面',
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
      key: 'item-5' as const,
      title: m.home_features_items_item_5_title(),
      description: m.home_features_items_item_5_description(),
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
      <div className="mx-auto max-w-6xl space-y-8 px-2 lg:space-y-20 lg:px-0 dark:[--color-border:color-mix(in_oklab,var(--color-white)_10%,transparent)]">
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
                <h3 className="text-foreground py-1 text-3xl font-semibold leading-normal lg:text-4xl">
                  {m.home_features_title()}
                </h3>
                <p className="text-muted-foreground mt-4">{m.home_features_description()}</p>
              </div>
              <Accordion
                value={[activeItem]}
                onValueChange={v => setActiveItem((v?.[0] as ImageKey) ?? 'item-1')}
                className="w-full">
                {featureItems.map(item => {
                  const ItemIcon = icons[item.key];
                  return (
                    <AccordionItem key={item.key} value={item.key}>
                      <AccordionTrigger>
                        <div className="flex items-center gap-2 text-base">
                          <ItemIcon className="size-4" />
                          {item.title}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">{item.description}</AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>

            <div className="bg-background relative flex w-full overflow-hidden rounded-2xl border p-2 lg:col-span-7 lg:h-auto">
              <div className="aspect-76/59 bg-background relative w-full rounded-2xl">
                <div
                  key={activeItem}
                  className="animate-crossfade-in bg-muted size-full overflow-hidden rounded-2xl border shadow-md">
                  <img
                    src={images[activeItem].image}
                    alt={images[activeItem].alt}
                    loading="lazy"
                    className="object-top-left size-full rounded-2xl object-cover dark:hidden"
                  />
                  <img
                    src={images[activeItem].darkImage}
                    alt={images[activeItem].alt}
                    loading="lazy"
                    className="object-top-left hidden size-full rounded-2xl object-cover dark:block"
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
