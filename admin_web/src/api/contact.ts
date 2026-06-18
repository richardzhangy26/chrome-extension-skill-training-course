import { m } from '@/locale/paraglide/messages';
import { createServerFn } from '@tanstack/react-start';
import { websiteConfig } from '@/config/website';
import { sendEmail } from '@/mail';
import { z } from 'zod';
const schema = z.object({
  name: z.string().min(3, m.contact_name_min()).max(30, m.contact_name_max()),
  email: z.email(m.contact_email_invalid()),
  message: z
    .string()
    .min(10, m.contact_message_min())
    .max(500, m.contact_message_max()),
});
export const sendContactMessage = createServerFn({ method: 'POST' })
  .inputValidator(schema)
  .handler(async ({ data }) => {
    const supportEmail = websiteConfig.mail?.supportEmail;
    if (!supportEmail) {
      throw new Error('Contact form is not configured');
    }
    const result = await sendEmail({
      to: supportEmail,
      template: 'contactMessage',
      context: {
        name: data.name.trim(),
        email: data.email.trim(),
        message: data.message.trim(),
      },
    });
    if (!result.success) {
      throw new Error('Failed to send the message');
    }
  });
