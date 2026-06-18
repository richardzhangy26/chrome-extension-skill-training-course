import { m } from '@/locale/paraglide/messages';
import { FormError } from '@/components/shared/form-error';
import { HeaderSection } from '@/components/shared/header-section';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { websiteConfig } from '@/config/website';
import { useSubscribeNewsletter } from '@/hooks/use-newsletter';
import { zodResolver } from '@hookform/resolvers/zod';
import { IconLoader2, IconSend2 } from '@tabler/icons-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
const schema = z.object({
  email: z.email(m.newsletter_email_invalid()),
});
type FormData = z.infer<typeof schema>;
export default function NewsletterCard() {
  const [error, setError] = useState<string | undefined>();
  const subscribeMutation = useSubscribeNewsletter();
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });
  const isPending = subscribeMutation.isPending;
  if (!websiteConfig.newsletter?.enable) return null;
  async function onSubmit(data: FormData) {
    setError(undefined);
    try {
      await subscribeMutation.mutateAsync(data.email);
      toast.success(m.newsletter_thanks());
      form.reset();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : m.newsletter_error();
      console.error('newsletter subscription error:', errMsg);
      setError(errMsg);
      toast.error(errMsg);
    }
  }
  return (
    <div className="w-full rounded-lg bg-linear-to-br from-primary/5 via-muted/80 to-chart-1/8 dark:from-primary/8 dark:via-muted/50 dark:to-chart-1/5 px-4 py-12 sm:px-8 md:p-16">
      <div className="flex flex-col items-center justify-center gap-8">
        <HeaderSection
          title={m.newsletter_title()}
          subtitle={m.newsletter_subtitle()}
          description={m.newsletter_description()}
        />

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex w-full max-w-md flex-col items-center gap-4"
          >
            <div className="flex w-full items-center">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="relative w-full space-y-0">
                    <FormLabel className="sr-only">
                      {m.newsletter_email()}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder={m.newsletter_placeholder_email()}
                        className="h-12 rounded-r-none border-r-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-primary focus:border-0.5 focus:border-r-0"
                        {...field}
                      />
                    </FormControl>
                    <div className="absolute -bottom-6 left-0">
                      <FormMessage className="text-destructive text-sm" />
                    </div>
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="h-12 rounded-l-none"
                disabled={isPending}
              >
                {isPending ? (
                  <IconLoader2
                    className="size-6 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <IconSend2 className="size-6" aria-hidden="true" />
                )}
                <span className="sr-only">{m.newsletter_subscribe()}</span>
              </Button>
            </div>
            {error && (
              <div className="w-full">
                <FormError message={error} />
              </div>
            )}
          </form>
        </Form>
      </div>
    </div>
  );
}
