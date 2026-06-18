import { m } from '@/locale/paraglide/messages';
import { FormError } from '@/components/shared/form-error';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { websiteConfig } from '@/config/website';
import { authClient } from '@/auth/client';
import { useUploadUserAvatar } from '@/hooks/use-user-files';
import { cn } from '@/lib/utils';
import { IconUser } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { DEFAULT_MAX_FILE_SIZE } from '@/storage/constants';
interface UpdateAvatarCardProps {
  className?: string;
}
/**
 * Update user avatar card
 */
export function UpdateAvatarCard({ className }: UpdateAvatarCardProps) {
  const [error, setError] = useState<string | undefined>('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const { data: session, refetch } = authClient.useSession();
  const uploadMutation = useUploadUserAvatar();
  useEffect(() => {
    if (session?.user?.image) setAvatarUrl(session.user.image);
  }, [session]);
  if (!websiteConfig.storage?.enable) return null;
  const user = session?.user;
  if (!user) return null;
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
    // Reset so selecting the same file again triggers onChange
    e.target.value = '';
  };
  const handleFileUpload = (file: File) => {
    const maxSize = websiteConfig.storage?.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
    if (file.size > maxSize) {
      setError('File size exceeds the server limit');
      toast.error('File size exceeds the server limit');
      return;
    }
    setError('');
    const tempUrl = URL.createObjectURL(file);
    setAvatarUrl(tempUrl);
    uploadMutation.mutate(file, {
      onSuccess: (result) => {
        authClient.updateUser(
          { image: result.url },
          {
            onSuccess: () => {
              setAvatarUrl(result.url);
              URL.revokeObjectURL(tempUrl);
              toast.success(m.settings_profile_avatar_success());
              refetch();
            },
            onError: (ctx) => {
              setError(`${ctx.error.status}: ${ctx.error.message}`);
              if (session?.user?.image) setAvatarUrl(session.user.image);
              URL.revokeObjectURL(tempUrl);
              toast.error(m.settings_profile_avatar_fail());
            },
          }
        );
      },
      onError: (err) => {
        const msg = err.message || m.settings_profile_avatar_fail();
        setError(msg);
        if (session?.user?.image) setAvatarUrl(session.user.image);
        URL.revokeObjectURL(tempUrl);
        toast.error(msg);
      },
    });
  };
  return (
    <Card
      className={cn(
        'w-full overflow-hidden py-0 pt-6 flex flex-col',
        className
      )}
    >
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          {m.settings_profile_avatar_title()}
        </CardTitle>
        <CardDescription>
          {m.settings_profile_avatar_description()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 flex-1">
        <div className="flex flex-col items-center sm:flex-row gap-4 sm:gap-8">
          <Avatar className="h-16 w-16 border">
            <AvatarImage src={avatarUrl ?? ''} alt={user.name ?? ''} />
            <AvatarFallback className="absolute inset-0">
              <IconUser className="h-8 w-8 text-muted-foreground" />
            </AvatarFallback>
          </Avatar>
          <label
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'cursor-pointer',
              uploadMutation.isPending && 'pointer-events-none opacity-50'
            )}
          >
            <input
              type="file"
              accept="image/png, image/jpeg, image/webp"
              onChange={handleFileChange}
              className="sr-only"
              disabled={uploadMutation.isPending}
            />
            {uploadMutation.isPending
              ? m.settings_profile_avatar_uploading()
              : m.settings_profile_avatar_upload_avatar()}
          </label>
        </div>
        <FormError message={error} />
      </CardContent>
      <CardFooter className="mt-auto px-6 py-4 flex justify-between items-center bg-muted rounded-none">
        <p className="text-sm text-muted-foreground">
          {m.settings_profile_avatar_hint()}
        </p>
      </CardFooter>
    </Card>
  );
}
