import { websiteConfig } from '@/config/website';
import { CreemProvider } from './provider/creem';
import { StripeProvider } from './provider/stripe';
import type {
  CheckoutResult,
  CreateCheckoutParams,
  CreatePortalParams,
  PaymentProvider,
  PaymentProviderName,
  PortalResult,
} from './types';

let paymentProvider: PaymentProvider | null = null;

type ProviderFactory = () => PaymentProvider;

const providerRegistry: Record<PaymentProviderName, ProviderFactory> = {
  stripe: () => new StripeProvider(),
  creem: () => new CreemProvider(),
};

function createProvider(): PaymentProvider {
  const paymentConfig = websiteConfig.payment;
  if (!paymentConfig?.enable) {
    throw new Error('Payment is disabled');
  }
  const name = paymentConfig.provider;
  if (!name) throw new Error('Payment provider is required.');
  const factory = providerRegistry[name as PaymentProviderName];
  if (!factory) {
    throw new Error(`Unsupported payment provider: ${name}.`);
  }
  return factory();
}

/** Whether payment (checkout/billing) is enabled */
export function isPaymentEnabled(): boolean {
  return !!websiteConfig.payment?.enable;
}

/**
 * Get the payment provider
 */
export function getPaymentProvider(): PaymentProvider {
  if (!paymentProvider) paymentProvider = createProvider();
  return paymentProvider;
}

export async function createCheckout(
  params: CreateCheckoutParams
): Promise<CheckoutResult> {
  const provider = getPaymentProvider();
  return provider.createCheckout(params);
}

export async function createCustomerPortal(
  params: CreatePortalParams
): Promise<PortalResult> {
  const provider = getPaymentProvider();
  return provider.createCustomerPortal(params);
}

export async function handleWebhookEvent(
  payload: string,
  signature: string
): Promise<void> {
  const provider = getPaymentProvider();
  await provider.handleWebhookEvent(payload, signature);
}
