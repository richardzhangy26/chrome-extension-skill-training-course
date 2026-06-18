import { websiteConfig } from '@/config/website';
import { DiscordProvider } from './provider/discord';
import { FeishuProvider } from './provider/feishu';
import type {
  NotificationProvider,
  NotificationProviderName,
  SendPaymentNotificationParams,
} from './types';

type ProviderFactory = () => NotificationProvider;

const providerRegistry: Record<NotificationProviderName, ProviderFactory> = {
  discord: () => new DiscordProvider(),
  feishu: () => new FeishuProvider(),
};

let notificationProvider: NotificationProvider | null = null;

function createProvider(): NotificationProvider {
  const name = websiteConfig.notification?.provider;
  if (!name)
    throw new Error('notification.provider is required in websiteConfig.');
  const factory = providerRegistry[name];
  if (!factory) {
    throw new Error(`Unsupported notification provider: ${name}.`);
  }
  return factory();
}

/**
 * Get the notification provider (lazy-initialized on first use)
 */
export function getNotificationProvider(): NotificationProvider {
  if (!notificationProvider) notificationProvider = createProvider();
  return notificationProvider;
}

/**
 * Send a payment notification
 */
export async function sendPaymentNotification(
  params: SendPaymentNotificationParams
): Promise<void> {
  if (!websiteConfig.notification?.enable) return;
  const provider = getNotificationProvider();
  await provider.sendPaymentNotification(params);
}
