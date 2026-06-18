import { serverEnv } from '@/env/server';
import type {
  CheckSubscribeStatusParams,
  NewsletterProvider,
  SubscribeNewsletterParams,
  UnsubscribeNewsletterParams,
} from '@/newsletter/types';
import { Resend } from 'resend';

/**
 * Resend newsletter provider
 * https://resend.com/docs/dashboard/audiences/contacts
 */
export class ResendNewsletterProvider implements NewsletterProvider {
  private resend: Resend;

  constructor() {
    const apiKey = serverEnv.RESEND_API_KEY;
    if (!apiKey) throw new Error('RESEND_API_KEY is required for newsletter.');
    this.resend = new Resend(apiKey);
  }

  getProviderName(): string {
    return 'resend';
  }

  /**
   * Subscribe by creating or updating contact. No pre-check (get) to avoid
   * hitting Resend rate limit (2 req/s). Try create first; if contact
   * already exists, update instead.
   */
  async subscribe({ email }: SubscribeNewsletterParams): Promise<boolean> {
    try {
      const createResult = await this.resend.contacts.create({
        email,
        unsubscribed: false,
      });
      if (!createResult.error) return true;

      // Create failed (e.g. contact already exists) -> update to subscribed
      const updateResult = await this.resend.contacts.update({
        email,
        unsubscribed: false,
      });
      if (updateResult.error) {
        console.error('Error updating contact', updateResult.error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error subscribing newsletter', error);
      return false;
    }
  }

  async unsubscribe({ email }: UnsubscribeNewsletterParams): Promise<boolean> {
    try {
      const result = await this.resend.contacts.update({
        email,
        unsubscribed: true,
      });
      if (result.error) {
        console.error('Error unsubscribing newsletter', result.error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error unsubscribing newsletter', error);
      return false;
    }
  }

  async checkSubscribeStatus({
    email,
  }: CheckSubscribeStatusParams): Promise<boolean> {
    try {
      const result = await this.resend.contacts.get({ email });
      if (result.error) return false;
      return !result.data?.unsubscribed;
    } catch (error) {
      console.error('Error checking subscribe status', error);
      return false;
    }
  }
}
