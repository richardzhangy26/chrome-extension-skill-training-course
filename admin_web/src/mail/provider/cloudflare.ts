import { websiteConfig } from '@/config/website';
import { getTemplate } from '../render';
import { serverEnv } from '@/env/server';
import type {
  MailProvider,
  SendEmailResult,
  SendRawEmailParams,
  SendTemplateParams,
} from '@/mail/types';

/**
 * Cloudflare Email Service provider implementation.
 * Uses the REST API to send emails, compatible with any Node.js environment.
 * https://developers.cloudflare.com/email-service/get-started/send-emails/
 * https://developers.cloudflare.com/email-service/api/send-emails/rest-api/
 */
export class CloudflareProvider implements MailProvider {
  private from: string;
  private accountId: string;
  private apiToken: string;
  private endpoint = 'https://api.cloudflare.com/client/v4/accounts';

  constructor() {
    const from = websiteConfig.mail?.fromEmail;
    if (!from) throw new Error('mail.fromEmail is required.');
    if (!serverEnv.CLOUDFLARE_ACCOUNT_ID) {
      throw new Error('CLOUDFLARE_ACCOUNT_ID is required.');
    }
    if (!serverEnv.CLOUDFLARE_API_TOKEN) {
      throw new Error('CLOUDFLARE_API_TOKEN is required.');
    }
    this.from = from;
    this.accountId = serverEnv.CLOUDFLARE_ACCOUNT_ID;
    this.apiToken = serverEnv.CLOUDFLARE_API_TOKEN;
  }

  getProviderName(): string {
    return 'cloudflare';
  }

  async sendTemplate(params: SendTemplateParams): Promise<SendEmailResult> {
    const { to, template, context } = params;
    try {
      const mailTemplate = await getTemplate({ template, context });
      return this.sendRawEmail({
        to,
        subject: mailTemplate.subject,
        html: mailTemplate.html,
        text: mailTemplate.text,
      });
    } catch (error) {
      console.error('Error sending template email:', error);
      return { success: false, error };
    }
  }

  async sendRawEmail(params: SendRawEmailParams): Promise<SendEmailResult> {
    const { to, subject, html, text } = params;
    if (!this.from || !to || !subject || !html) {
      console.warn('Missing required fields for email send', {
        from: this.from,
        to,
        subject,
        html,
      });
      return { success: false, error: 'Missing required fields' };
    }
    try {
      const url = `${this.endpoint}/${this.accountId}/email/sending/send`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to,
          from: this.from,
          subject,
          html,
          text,
        }),
      });
      const data = (await response.json()) as {
        success: boolean;
        result?: { delivered: string[] };
        errors?: { code: number; message: string }[];
      };

      if (!data.success) {
        const errorMsg =
          data.errors?.map((e) => `${e.code}: ${e.message}`).join(', ') ||
          'Unknown error';
        console.error('Error sending email via Cloudflare:', errorMsg);
        return { success: false, error: errorMsg };
      }

      const messageId = data.result?.delivered?.[0];
      return { success: true, messageId };
    } catch (error) {
      console.error('Error sending email via Cloudflare:', error);
      return { success: false, error };
    }
  }
}
