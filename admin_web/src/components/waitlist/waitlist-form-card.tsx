import { m } from '@/locale/paraglide/messages';
import { websiteConfig } from '@/config/website';
import { useSubscribeNewsletter } from '@/hooks/use-newsletter';
import { FormError } from '@/components/shared/form-error';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
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
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
const schema = z.object({
  email: z.string().email(m.waitlist_email_invalid()),
});
type FormValues = z.infer<typeof schema>;
export function WaitlistFormCard() {
  if (!websiteConfig.newsletter?.enable) return null;
  const [error, setError] = useState<string | undefined>();
  const subscribeMutation = useSubscribeNewsletter();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });
  const isPending = subscribeMutation.isPending;
  async function onSubmit(values: FormValues) {
    setError(undefined);
    try {
      await subscribeMutation.mutateAsync(values.email);
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : m.waitlist_error());
    }
  }
  return (
    <Card className="mx-auto max-w-lg overflow-hidden pt-6 pb-0">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          {m.waitlist_form_title()}
        </CardTitle>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col">
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{m.waitlist_email()}</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder={m.waitlist_placeholder_email()}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormError message={error} />
          </CardContent>
          <CardFooter className="mt-6 flex items-center justify-between rounded-none border-t bg-muted px-6 py-4">
            <Button type="submit" disabled={isPending}>
              {isPending ? m.waitlist_subscribing() : m.waitlist_subscribe()}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
