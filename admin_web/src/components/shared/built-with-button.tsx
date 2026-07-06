import { buttonVariants } from '@/components/ui/button';
import { REPO_URL } from '@/config/links';
import { websiteConfig } from '@/config/website';
import { cn } from '@/lib/utils';

export default function BuiltWithButton() {
  const name = websiteConfig.metadata?.name ?? 'Polymas 训练助手';
  const logo = websiteConfig.metadata?.images?.logoLight ?? '/logo.png';

  return (
    <a
      target="_blank"
      rel="noopener noreferrer"
      href={REPO_URL}
      className={cn(
        buttonVariants({ variant: 'outline', size: 'sm' }),
        'border-border gap-2 rounded-md border px-4 py-4',
      )}>
      <span>开源项目</span>
      <img src={logo} alt={`${name} logo`} className="size-5" />
      <span className="font-semibold">{name}</span>
    </a>
  );
}
