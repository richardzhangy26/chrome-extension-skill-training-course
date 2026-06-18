import type { MailConfig } from "@/types";

/**
 * Supported mail provider names
 **/
export type MailProviderName = NonNullable<
  MailConfig['provider']
>;

/**
 * Email template names
 */
export type EmailTemplate =
  | 'forgotPassword'
  | 'verifyEmail'
  | 'subscribeNewsletter'
  | 'contactMessage';

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: unknown;
}

export interface SendTemplateParams {
  to: string;
  template: EmailTemplate;
  context: Record<string, unknown>;
}

export interface SendRawEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Mail provider interface
 */
export interface MailProvider {
  /**
   * Get the provider's name
   */
  getProviderName(): string;

  /**
   * Send an email using a template
   */
  sendTemplate(params: SendTemplateParams): Promise<SendEmailResult>;
  
  /**
   * Send a raw email
   */
  sendRawEmail(params: SendRawEmailParams): Promise<SendEmailResult>;
}
