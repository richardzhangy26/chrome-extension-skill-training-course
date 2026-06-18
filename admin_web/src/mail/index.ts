import { websiteConfig } from '@/config/website';
import type {
  MailProvider,
  MailProviderName,
  SendEmailResult,
  SendRawEmailParams,
  SendTemplateParams,
} from './types';
import { ResendProvider } from './provider/resend';
import { CloudflareProvider } from './provider/cloudflare';

let mailProvider: MailProvider | null = null;

type ProviderFactory = () => MailProvider;

const providerRegistry: Record<MailProviderName, ProviderFactory> = {
  resend: () => new ResendProvider(),
  cloudflare: () => new CloudflareProvider(),
};

function createProvider(): MailProvider {
  const name = websiteConfig.mail?.provider;
  if (!name) throw new Error('mail.provider is required in websiteConfig.');
  const factory = providerRegistry[name as MailProviderName];
  if (!factory) {
    throw new Error(`Unsupported mail provider: ${name}.`);
  }
  return factory();
}

/**
 * Get the mail provider (lazy-initialized on first use)
 */
export function getMailProvider(): MailProvider {
  if (!mailProvider) mailProvider = createProvider();
  return mailProvider;
}

/**
 * Send email using the configured mail provider.
 * Returns { success, messageId?, error? } so callers can distinguish
 * "feature disabled" from "send failed" and access error details.
 */
export async function sendEmail(
  params: SendTemplateParams | SendRawEmailParams
): Promise<SendEmailResult> {
  if (!websiteConfig.mail?.enable) {
    return { success: false, error: 'Mail feature is disabled' };
  }
  try {
    const provider = getMailProvider();
    const result =
      'template' in params
        ? await provider.sendTemplate(params)
        : await provider.sendRawEmail(params);
    if (!result.success) {
      console.error('[mail] Send failed:', result.error);
    }
    return result;
  } catch (error) {
    console.error('[mail] Unexpected error:', error);
    return { success: false, error };
  }
}
