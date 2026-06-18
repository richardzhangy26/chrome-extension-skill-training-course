import { IconUser } from '@tabler/icons-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

/**
 * User avatar
 */
export function UserAvatar({
  name,
  image,
  className,
}: {
  name: string | null;
  image: string | null;
  className?: string;
}) {
  return (
    <Avatar className={cn('size-8 border', className)}>
      <AvatarImage
        alt={name ?? ''}
        src={image ?? undefined}
        referrerPolicy="no-referrer"
      />
      <AvatarFallback className="absolute inset-0">
        <span className="sr-only">{name ?? 'User'}</span>
        <IconUser className="size-4" />
      </AvatarFallback>
    </Avatar>
  );
}
