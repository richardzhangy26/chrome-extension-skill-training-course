import { m } from '@/locale/paraglide/messages';
import { Link, useRouter } from '@tanstack/react-router';
import { IconArrowLeft } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BackButtonSmallProps {
  href?: string;
  className?: string;
}

export default function BackButtonSmall({
  href,
  className,
}: BackButtonSmallProps) {
  const router = useRouter();

  const button = (
    <Button
      size="sm"
      variant="outline"
      className={cn('size-8 px-0', className)}
      aria-label={m.common_go_back()}
    >
      <IconArrowLeft className="size-4" />
    </Button>
  );

  if (href != null) {
    return (
      <Link to={href} aria-label={m.common_go_back()}>
        {button}
      </Link>
    );
  }
  return (
    <Button
      size="sm"
      variant="outline"
      className={cn('size-8 px-0', className)}
      onClick={() => router.history.back()}
      aria-label={m.common_go_back()}
    >
      <IconArrowLeft className="size-4" />
    </Button>
  );
}
