import { serverEnv } from '@/env/server';
import type {
  NotificationProvider,
  SendPaymentNotificationParams,
} from '../types';

/**
 * Send a message to Feishu via webhook.
 */
async function sendMessage(
  webhookUrl: string,
  body: Record<string, unknown>
): Promise<void> {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    console.error('Failed to send Feishu message:', response);
  }
}

export class FeishuProvider implements NotificationProvider {
  private webhookUrl: string;

  constructor() {
    const webhookUrl = serverEnv.FEISHU_WEBHOOK_URL;
    if (!webhookUrl) throw new Error('FEISHU_WEBHOOK_URL is required.');
    this.webhookUrl = webhookUrl;
  }

  getProviderName(): string {
    return 'feishu';
  }

  async sendPaymentNotification(
    params: SendPaymentNotificationParams
  ): Promise<void> {
    const { sessionId, customerId, userName, amount } = params;
    try {
      await sendMessage(this.webhookUrl, {
        msg_type: 'text',
        content: {
          text: `🎉 New Purchase\nUsername: ${userName}\nAmount: $${amount.toFixed(2)}\nCustomer ID: ${customerId}\nSession ID: ${sessionId}`,
        },
      });
      console.log(`Successfully sent Feishu notification for user ${userName}`);
    } catch (error) {
      console.error('Failed to send Feishu notification:', error);
    }
  }
}
