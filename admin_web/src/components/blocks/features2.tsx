import { m } from '@/locale/paraglide/messages';
import { HeaderSection } from '@/components/shared/header-section';
import { ScrollReveal } from '@/components/shared/scroll-reveal';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { Icon } from '@tabler/icons-react';
import { IconDownload, IconKey, IconLogin2, IconMessage2, IconSettings } from '@tabler/icons-react';
import { useState } from 'react';
import { getR2AssetUrl } from '@/config/r2-assets';

type StepKey = 'step-1' | 'step-2' | 'step-3' | 'step-4' | 'step-5';

type StepItem = {
  key: StepKey;
  title: string;
  description: string;
  image: string;
  alt: string;
  icon: Icon;
};

const Features2Section = () => {
  const [activeStep, setActiveStep] = useState<StepKey>('step-1');
  const stepItems: StepItem[] = [
    {
      key: 'step-1',
      title: m.home_features2_step1_title(),
      description: m.home_features2_step1_description(),
      image: getR2AssetUrl('steps/install-extension.png'),
      alt: m.home_features2_step1_alt(),
      icon: IconDownload,
    },
    {
      key: 'step-2',
      title: m.home_features2_step2_title(),
      description: m.home_features2_step2_description(),
      image: getR2AssetUrl('steps/open-polymas-training.png'),
      alt: m.home_features2_step2_alt(),
      icon: IconLogin2,
    },
    {
      key: 'step-3',
      title: m.home_features2_step3_title(),
      description: m.home_features2_step3_description(),
      image: getR2AssetUrl('steps/api-key-test-success.png'),
      alt: m.home_features2_step3_alt(),
      icon: IconKey,
    },
    {
      key: 'step-4',
      title: m.home_features2_step4_title(),
      description: m.home_features2_step4_description(),
      image: getR2AssetUrl('steps/configure-student-profile.png'),
      alt: m.home_features2_step4_alt(),
      icon: IconSettings,
    },
    {
      key: 'step-5',
      title: m.home_features2_step5_title(),
      description: m.home_features2_step5_description(),
      image: getR2AssetUrl('steps/start-training-conversation.png'),
      alt: m.home_features2_step5_alt(),
      icon: IconMessage2,
    },
  ];
  const activeStepItem = stepItems.find(item => item.key === activeStep) ?? stepItems[0];

  return (
    <section id="features2" className="px-4 py-16 md:py-24">
      <div className="mx-auto max-w-6xl space-y-8 px-2 lg:space-y-20 lg:px-0 dark:[--color-border:color-mix(in_oklab,var(--color-white)_10%,transparent)]">
        <ScrollReveal>
          <HeaderSection
            title={m.home_features2_title()}
            subtitle={m.home_features2_subtitle()}
            description={m.home_features2_description()}
          />
        </ScrollReveal>

        <ScrollReveal delay={150}>
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-24">
            <div className="flex flex-col gap-8 lg:col-span-5">
              <div className="text-left lg:pr-0">
                <h3 className="text-foreground py-1 text-3xl font-semibold leading-normal lg:text-4xl">
                  {m.home_features2_title()}
                </h3>
                <p className="text-muted-foreground mt-4">{m.home_features2_description()}</p>
              </div>

              <Accordion
                value={[activeStep]}
                onValueChange={value => {
                  const nextStep = value.find(item => item !== activeStep) as StepKey | undefined;
                  if (nextStep) {
                    setActiveStep(nextStep);
                  }
                }}
                className="w-full">
                {stepItems.map(item => {
                  const StepIcon = item.icon;
                  return (
                    <AccordionItem key={item.key} value={item.key}>
                      <AccordionTrigger>
                        <div className="flex items-center gap-2 text-base">
                          <StepIcon className="size-4 shrink-0" />
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
              <div className="aspect-76/59 bg-muted/40 relative w-full overflow-hidden rounded-2xl">
                <div
                  key={activeStep}
                  className="animate-crossfade-in size-full overflow-hidden rounded-2xl border shadow-md">
                  <img
                    src={activeStepItem.image}
                    alt={activeStepItem.alt}
                    loading="lazy"
                    className="size-full rounded-2xl object-contain"
                  />
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};

export default Features2Section;
