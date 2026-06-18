import { createServerFn } from '@tanstack/react-start';
import { websiteConfig } from '@/config/website';
import { sendEmail } from '@/mail';
import { isSubscribed, subscribe, unsubscribe } from '@/newsletter';
import { z } from 'zod';

const emailSchema = z.email('Please enter a valid email address');

function ensureNewsletterEnabled(): void {
  if (!websiteConfig.newsletter?.enable) {
    throw new Error('Newsletter is disabled');
  }
}

export const getNewsletterStatus = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ email: emailSchema }))
  .handler(async ({ data }) => {
    ensureNewsletterEnabled();
    try {
      const subscribed = await isSubscribed(data.email);
      return { subscribed };
    } catch (error) {
      console.error('Check newsletter status error:', error);
      throw new Error(
        error instanceof Error ? error.message : 'Something went wrong'
      );
    }
  });

export const subscribeNewsletter = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ email: emailSchema }))
  .handler(async ({ data }) => {
    ensureNewsletterEnabled();
    try {
      const ok = await subscribe(data.email);
      if (!ok) {
        throw new Error('Failed to subscribe to the newsletter');
      }
      if (websiteConfig.mail?.fromEmail) {
        // Wait for 3 seconds to ensure the newsletter is subscribed
        await new Promise((r) => setTimeout(r, 3000));
        try {
          await sendEmail({
            to: data.email,
            template: 'subscribeNewsletter',
            context: { email: data.email },
          });
        } catch (e) {
          console.error('Newsletter welcome email error:', e);
        }
      }
    } catch (error) {
      console.error('Subscribe newsletter error:', error);
      throw new Error(
        error instanceof Error ? error.message : 'Something went wrong'
      );
    }
  });

export const unsubscribeNewsletter = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ email: emailSchema }))
  .handler(async ({ data }) => {
    ensureNewsletterEnabled();
    try {
      const ok = await unsubscribe(data.email);
      if (!ok) {
        throw new Error('Failed to unsubscribe from the newsletter');
      }
    } catch (error) {
      console.error('Unsubscribe newsletter error:', error);
      throw new Error(
        error instanceof Error ? error.message : 'Something went wrong'
      );
    }
  });
