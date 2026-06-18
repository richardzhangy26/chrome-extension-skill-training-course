import { websiteConfig } from '@/config/website';
import { ResendNewsletterProvider } from './provider/resend';
import { BeehiivNewsletterProvider } from './provider/beehiiv';
import type { NewsletterProvider, NewsletterProviderName } from './types';

type ProviderFactory = () => NewsletterProvider;

const providerRegistry: Record<NewsletterProviderName, ProviderFactory> = {
  resend: () => new ResendNewsletterProvider(),
  beehiiv: () => new BeehiivNewsletterProvider(),
};

function createProvider(): NewsletterProvider {
  const config = websiteConfig.newsletter;
  if (!config?.enable || !config?.provider) {
    throw new Error('Newsletter is disabled or provider not set.');
  }
  const name = config.provider;
  const factory = providerRegistry[name as NewsletterProviderName];
  if (!factory) {
    throw new Error(`Unsupported newsletter provider: ${name}.`);
  }
  return factory();
}

export function getNewsletterProvider(): NewsletterProvider {
  return createProvider();
}

export async function subscribe(email: string): Promise<boolean> {
  if (!websiteConfig.newsletter?.enable) return false;
  const provider = getNewsletterProvider();
  return provider.subscribe({ email });
}

export async function unsubscribe(email: string): Promise<boolean> {
  if (!websiteConfig.newsletter?.enable) return false;
  const provider = getNewsletterProvider();
  return provider.unsubscribe({ email });
}

export async function isSubscribed(email: string): Promise<boolean> {
  if (!websiteConfig.newsletter?.enable) return false;
  const provider = getNewsletterProvider();
  return provider.checkSubscribeStatus({ email });
}
