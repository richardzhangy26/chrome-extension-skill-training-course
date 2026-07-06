import { m } from '@/locale/paraglide/messages';
import Container from '@/components/layout/container';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { IconArrowRight } from '@tabler/icons-react';
import { getR2AssetUrl } from '@/config/r2-assets';
import { DOWNLOAD_URL, REPO_URL } from '@/config/links';
export default function HeroSection() {
  return (
    <section id="hero" className="overflow-hidden">
      {/* background, warm-tinted light blobs on top of the hero section */}
      <div aria-hidden="true" className="absolute inset-0 isolate hidden opacity-65 contain-strict lg:block">
        <div className="w-140 h-320 -translate-y-87.5 absolute left-0 top-0 -rotate-45 rounded-full bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,oklch(0.85_0.04_55/.12)_0,oklch(0.7_0.02_45/.04)_50%,transparent_80%)]" />
        <div className="h-320 absolute left-0 top-0 w-60 -rotate-45 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,oklch(0.88_0.05_38/.1)_0,oklch(0.6_0.02_38/.03)_80%,transparent_100%)] [translate:5%_-50%]" />
        <div className="h-320 -translate-y-87.5 absolute left-0 top-0 w-60 -rotate-45 bg-[radial-gradient(50%_50%_at_50%_50%,oklch(0.9_0.03_65/.08)_0,oklch(0.65_0.015_50/.03)_80%,transparent_100%)]" />
      </div>

      <div className="relative pt-12">
        <Container className="px-6">
          <div className="text-center sm:mx-auto lg:mr-auto lg:mt-0">
            {/* introduction */}
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="animate-fade-up hover:bg-muted border-border focus-visible:ring-primary group mx-auto flex w-fit items-center gap-2 rounded-full border p-1 pl-4 transition-colors delay-0 focus-visible:rounded-full focus-visible:ring-2 focus-visible:ring-offset-2">
              <span className="text-foreground text-sm font-medium">{m.home_hero_introduction()}</span>
              <div className="bg-muted size-6 overflow-hidden rounded-full duration-500">
                <div className="flex w-12 -translate-x-1/2 duration-500 ease-in-out group-hover:translate-x-0">
                  <span className="flex size-6">
                    <IconArrowRight className="text-foreground m-auto size-3" />
                  </span>
                  <span className="flex size-6">
                    <IconArrowRight className="text-foreground m-auto size-3" />
                  </span>
                </div>
              </div>
            </a>

            {/* title */}
            <h1 className="animate-fade-up delay-1 mt-8 text-balance text-3xl font-bold sm:text-4xl md:text-5xl lg:mt-16 xl:text-[4rem]">
              {m.home_hero_title()}
            </h1>

            {/* description */}
            <p className="animate-fade-up delay-2 text-muted-foreground mx-auto mt-6 max-w-5xl text-balance text-base sm:mt-8 sm:text-lg">
              {m.home_hero_description()}
            </p>

            {/* action buttons */}
            <div className="animate-fade-up delay-3 mt-8 flex flex-wrap items-center justify-center gap-3 sm:mt-12 sm:gap-4">
              <div className="bg-foreground/10 rounded-xl">
                <a
                  href={DOWNLOAD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ size: 'lg' }), 'h-10.5 rounded-xl px-5 text-base')}>
                  <span className="text-nowrap">{m.home_hero_primary()}</span>
                </a>
              </div>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ size: 'lg', variant: 'outline' }), 'h-10.5 rounded-xl px-5')}>
                <span className="text-nowrap">{m.home_hero_secondary()}</span>
              </a>
            </div>
          </div>

          {/* Polymas extension product showcase */}
          <div className="animate-fade-up delay-4 relative my-8 overflow-hidden px-2 sm:my-12 md:my-16">
            <div className="inset-shadow-2xs ring-muted/50 dark:inset-shadow-white/20 bg-muted/50 relative mx-auto max-w-6xl overflow-hidden rounded-2xl border p-2 shadow-2xl shadow-cyan-950/20 ring-1 sm:p-4">
              <img
                className="relative w-full rounded-xl bg-black"
                src={getR2AssetUrl('polymas-hero.webp')}
                alt={m.block_hero_image_alt({ mode: 'dark' })}
                fetchPriority="high"
                width={1568}
                height={1003}
              />
            </div>
          </div>
        </Container>
      </div>
    </section>
  );
}
