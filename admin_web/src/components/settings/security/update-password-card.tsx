import { m } from '@/locale/paraglide/messages';
import { FormError } from '@/components/shared/form-error';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { authClient } from '@/auth/client';
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { IconEye, IconEyeOff } from '@tabler/icons-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
const passwordSchema = z.object({
  currentPassword: z.string().min(1, {
    message: m.settings_security_update_password_current_required(),
  }),
  newPassword: z
    .string()
    .min(8, { message: m.settings_security_update_password_new_min_length() }),
});
interface UpdatePasswordCardProps {
  className?: string;
}
export function UpdatePasswordCard({ className }: UpdatePasswordCardProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | undefined>('');
  const { data: session } = authClient.useSession();
  const form = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  });
  const user = session?.user;
  if (!user) return null;
  const onSubmit = async (values: z.infer<typeof passwordSchema>) => {
    await authClient.changePassword(
      {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        revokeOtherSessions: true,
      },
      {
        onRequest: () => {
          setIsSaving(true);
          setError('');
        },
        onResponse: () => {
          setIsSaving(false);
        },
        onSuccess: () => {
          toast.success(m.settings_security_update_password_success());
          form.reset();
        },
        onError: (ctx) => {
          setError(`${ctx.error.status}: ${ctx.error.message}`);
          toast.error(m.settings_security_update_password_fail());
        },
      }
    );
  };
  return (
    <Card
      className={cn(
        'w-full overflow-hidden pt-6 pb-0 flex flex-col',
        className
      )}
    >
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          {m.settings_security_update_password_title()}
        </CardTitle>
        <CardDescription>
          {m.settings_security_update_password_description()}
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col flex-1"
        >
          <CardContent className="space-y-4 flex-1">
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {m.settings_security_update_password_current_password()}
                  </FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input
                        type={showCurrent ? 'text' : 'password'}
                        placeholder={m.settings_security_update_password_placeholder_current()}
                        {...field}
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowCurrent(!showCurrent)}
                    >
                      {showCurrent ? (
                        <IconEyeOff className="size-4" />
                      ) : (
                        <IconEye className="size-4" />
                      )}
                      <span className="sr-only">
                        {showCurrent
                          ? m.settings_security_update_password_hide_password()
                          : m.settings_security_update_password_show_password()}
                      </span>
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {m.settings_security_update_password_new_password()}
                  </FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input
                        type={showNew ? 'text' : 'password'}
                        placeholder={m.settings_security_update_password_placeholder_new()}
                        {...field}
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowNew(!showNew)}
                    >
                      {showNew ? (
                        <IconEyeOff className="size-4" />
                      ) : (
                        <IconEye className="size-4" />
                      )}
                      <span className="sr-only">
                        {showNew
                          ? m.settings_security_update_password_hide_password()
                          : m.settings_security_update_password_show_password()}
                      </span>
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormError message={error} />
          </CardContent>
          <CardFooter className="mt-6 px-6 py-4 flex justify-between items-center bg-muted rounded-none">
            <p className="text-sm text-muted-foreground">
              {m.settings_security_update_password_hint()}
            </p>
            <Button type="submit" disabled={isSaving}>
              {isSaving
                ? m.settings_security_update_password_saving()
                : m.settings_security_update_password_save()}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
