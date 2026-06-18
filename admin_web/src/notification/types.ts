import type { NotificationConfig } from '@/types';

/** Supported notification provider names */
export type NotificationProviderName = NonNullable<
  NotificationConfig['provider']
>;

/** Params for sending a payment notification */
export interface SendPaymentNotificationParams {
  sessionId: string;
  customerId: string;
  userName: string;
  amount: number;
}

/**
 * Notification provider interface
 */
export interface NotificationProvider {
  /**
   * Get the provider's name
   */
  getProviderName(): string;

  /**
   * Send a payment notification
   */
  sendPaymentNotification(params: SendPaymentNotificationParams): Promise<void>;
}
