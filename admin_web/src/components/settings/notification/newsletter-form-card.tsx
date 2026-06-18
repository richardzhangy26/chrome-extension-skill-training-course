import { m } from '@/locale/paraglide/messages';
import { FormError } from '@/components/shared/form-error';
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
} from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { websiteConfig } from '@/config/website';
import {
  useNewsletterStatus,
  useSubscribeNewsletter,
  useUnsubscribeNewsletter,
} from '@/hooks/use-newsletter';
import { authClient } from '@/auth/client';
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { IconLoader2 } from '@tabler/icons-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
interface NewsletterFormCardProps {
  className?: string;
}
const formSchema = z.object({ subscribed: z.boolean() });
export function NewsletterFormCard({ className }: NewsletterFormCardProps) {
  if (!websiteConfig.newsletter?.enable) return null;
  const { data: session } = authClient.useSession();
  const currentUser = session?.user;
  const {
    data: newsletterStatus,
    isLoading: isStatusLoading,
    error: statusError,
  } = useNewsletterStatus(currentUser?.email);
  const subscribeMutation = useSubscribeNewsletter();
  const unsubscribeMutation = useUnsubscribeNewsletter();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { subscribed: false },
  });
  useEffect(() => {
    if (newsletterStatus)
      form.setValue('subscribed', newsletterStatus.subscribed);
  }, [newsletterStatus, form]);
  if (!currentUser) return null;
  const handleSubscriptionChange = async (value: boolean) => {
    if (!currentUser.email) {
      toast.error(m.settings_notification_newsletter_email_required());
      return;
    }
    try {
      if (value) {
        await subscribeMutation.mutateAsync(currentUser.email);
        toast.success(m.settings_notification_newsletter_subscribe_success());
      } else {
        await unsubscribeMutation.mutateAsync(currentUser.email);
        toast.success(m.settings_notification_newsletter_unsubscribe_success());
      }
    } catch (err) {
      console.error('newsletter subscription error:', err);
      const msg =
        err instanceof Error
          ? err.message
          : m.settings_notification_newsletter_error();
      toast.error(msg);
      form.setValue('subscribed', newsletterStatus?.subscribed ?? false);
    }
  };
  return (
    <Card className={cn('w-full overflow-hidden pt-6 pb-0', className)}>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          {m.settings_notification_newsletter_title()}
        </CardTitle>
        <CardDescription>
          {m.settings_notification_newsletter_description()}
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="subscribed"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between">
                  <FormLabel className="text-base">
                    {m.settings_notification_newsletter_label()}
                  </FormLabel>
                  <div className="relative flex items-center">
                    {(isStatusLoading ||
                      subscribeMutation.isPending ||
                      unsubscribeMutation.isPending) && (
                      <IconLoader2 className="mr-2 size-4 animate-spin text-primary" />
                    )}
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          field.onChange(checked);
                          handleSubscriptionChange(checked);
                        }}
                        disabled={
                          isStatusLoading ||
                          subscribeMutation.isPending ||
                          unsubscribeMutation.isPending
                        }
                      />
                    </FormControl>
                  </div>
                </FormItem>
              )}
            />
            <FormError
              message={
                statusError?.message ??
                subscribeMutation.error?.message ??
                unsubscribeMutation.error?.message
              }
            />
          </CardContent>
          <CardFooter className="mt-6 px-6 py-4 bg-muted rounded-none">
            <p className="text-sm text-muted-foreground">
              {m.settings_notification_newsletter_hint()}
            </p>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
