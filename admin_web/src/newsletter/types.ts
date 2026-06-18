import type { NewsletterConfig } from "@/types";

/**
 * Supported newsletter provider names
 **/
export type NewsletterProviderName = NonNullable<
  NewsletterConfig['provider']
>;

export interface SubscribeNewsletterParams {
  email: string;
}

export interface UnsubscribeNewsletterParams {
  email: string;
}

export interface CheckSubscribeStatusParams {
  email: string;
}

export type SubscribeNewsletterHandler = (
  params: SubscribeNewsletterParams
) => Promise<boolean>;

export type UnsubscribeNewsletterHandler = (
  params: UnsubscribeNewsletterParams
) => Promise<boolean>;

export type CheckSubscribeStatusHandler = (
  params: CheckSubscribeStatusParams
) => Promise<boolean>;

/**
 * Newsletter provider interface
 */
export interface NewsletterProvider {
  /**
   * Get the provider's name
   */
  getProviderName(): string;

  /**
   * Subscribe to the newsletter
   */
  subscribe: SubscribeNewsletterHandler;
  
  /**
   * Unsubscribe from the newsletter
   */
  unsubscribe: UnsubscribeNewsletterHandler;
  
  /**
   * Check if the user is subscribed to the newsletter
   */
  checkSubscribeStatus: CheckSubscribeStatusHandler;
}
