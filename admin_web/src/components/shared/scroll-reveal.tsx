import { useInView } from '@/hooks/use-in-view';
import { cn } from '@/lib/utils';

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: React.ElementType;
}

export function ScrollReveal({
  children,
  className,
  delay = 0,
  as: Component = 'div',
}: ScrollRevealProps) {
  const { ref, isInView } = useInView();

  return (
    <Component
      ref={ref}
      className={cn(isInView ? 'reveal-visible' : 'reveal-hidden', className)}
      style={delay > 0 ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Component>
  );
}
