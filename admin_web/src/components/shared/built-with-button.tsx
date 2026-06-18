import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function BuiltWithButton() {
  return (
    <a
      target="_blank"
      rel="noopener noreferrer"
      href="https://tanstarter.com?utm_source=built-with-tanstarter"
      className={cn(
        buttonVariants({ variant: 'outline', size: 'sm' }),
        'border border-border px-4 py-4 rounded-md gap-2'
      )}
    >
      <span>Built with</span>
      <img src="/tanstarter.png" alt="TanStarter" className="size-5" />
      <span className="font-semibold">TanStarter</span>
    </a>
  );
}
