import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export default function Container({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div id={id} className={cn('container mx-auto max-w-7xl', className)}>
      {children}
    </div>
  );
}
