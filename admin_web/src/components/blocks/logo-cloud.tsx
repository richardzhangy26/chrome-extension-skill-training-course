import { m } from '@/locale/paraglide/messages';
import { ScrollReveal } from '@/components/shared/scroll-reveal';
const chips: { name: string; dot: string }[] = [
  { name: 'Chrome', dot: 'var(--chart-1)' },
  { name: 'Edge', dot: 'var(--chart-2)' },
  { name: 'Brave', dot: 'var(--chart-3)' },
  { name: 'Firefox', dot: 'var(--chart-4)' },
  { name: '豆包', dot: 'var(--chart-1)' },
  { name: 'GPT-4o', dot: 'var(--chart-2)' },
  { name: 'Gemini', dot: 'var(--chart-3)' },
  { name: 'Claude', dot: 'var(--chart-5)' },
  { name: '通义千问', dot: 'var(--chart-4)' },
];
export default function LogoCloudSection() {
  return (
    <section id="logo-cloud" className="relative overflow-hidden px-4 py-16 md:py-24">
      <div className="bg-linear-to-b from-muted/60 absolute inset-0 to-transparent" />
      <div className="relative mx-auto max-w-5xl px-6">
        <ScrollReveal>
          <h2 className="text-center text-xl font-medium">{m.home_logo_cloud_title()}</h2>
        </ScrollReveal>
        <ScrollReveal delay={150}>
          <div className="mx-auto mt-12 flex max-w-4xl flex-wrap items-center justify-center gap-3">
            {chips.map(chip => (
              <div
                key={chip.name}
                className="border-border bg-muted/40 hover:border-primary/40 hover:bg-primary/5 inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 transition-colors duration-200">
                <span className="size-2 shrink-0 rounded-full" style={{ background: chip.dot }} />
                <span className="text-foreground/80 whitespace-nowrap text-sm font-medium">{chip.name}</span>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
