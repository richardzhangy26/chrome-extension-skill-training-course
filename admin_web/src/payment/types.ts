import type { PaymentConfig } from "@/types";

/**
 * Payment types: subscription and one-time
 */
export type PaymentType = 'subscription' | 'one_time';

export const PaymentTypes = {
  SUBSCRIPTION: 'subscription' as const,
  ONE_TIME: 'one_time' as const,
};

/**
 * Payment scene: subscription and lifetime
 */
export type PaymentScene = 'subscription' | 'lifetime';

export const PaymentScenes = {
  LIFETIME: 'lifetime' as const,
  SUBSCRIPTION: 'subscription' as const,
};

export type PlanInterval = 'month' | 'year';

export const PlanIntervals = {
  MONTH: 'month' as const,
  YEAR: 'year' as const,
};

/**
 * Status of a payment or subscription
 */
export type PaymentStatus =
  | 'active'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'past_due'
  | 'paused'
  | 'trialing'
  | 'unpaid'
  | 'completed'
  | 'processing'
  | 'failed';

/**
 * Price definition for a plan
 */
export interface Price {
  type: PaymentType;                 // Type of payment (subscription or one_time)
  priceId: string;                   // Stripe price ID (not product id)
  amount: number;                    // Price amount in currency units (dollars, euros, etc.)
  currency: string;                  // Currency code (e.g., USD)
  interval?: PlanInterval;           // Billing interval for recurring payments
  trialPeriodDays?: number;          // Free trial period in days
  allowPromotionCode?: boolean;      // Whether to allow promotion code for this price
  disabled?: boolean;                // Whether to disable this price in UI
}

/**
 * Price plan definition
 *
 * 1. When to set the plan disabled?
 * When the plan is not available anymore, but you should keep it for existing users
 * who have already purchased it, otherwise they can not see the plan in the Billing page.
 *
 * 2. When to set the price disabled?
 * When the price is not available anymore, but you should keep it for existing users
 * who have already purchased it, otherwise they can not see the price in the Billing page.
 */
export interface PricePlan {
  id: string;                        // Unique identifier for the plan
  name?: string;                     // Display name of the plan
  description?: string;              // Description of the plan features
  features?: string[];               // List of features included in this plan
  limits?: string[];                 // List of limits for this plan
  prices: Price[];                   // Available prices for this plan
  isFree: boolean;                   // Whether this is a free plan
  isLifetime: boolean;               // Whether this is a lifetime plan
  popular?: boolean;                 // Whether to mark this plan as popular in UI
  disabled?: boolean;                // Whether to disable this plan in UI
}

/**
 * Subscription data
 */
export interface Subscription {
  id: string;
  customerId: string;
  status: PaymentStatus;
  priceId: string;
  type: PaymentType;
  interval?: PlanInterval;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  trialStartDate?: Date;
  trialEndDate?: Date;
  createdAt: Date;
}

/**
 * Payment data
 */
export interface Payment {
  id: string;
  customerId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  createdAt: Date;
  metadata?: Record<string, string>;
}

/**
 * Parameters for creating a checkout session
 */
export interface CreateCheckoutParams {
  planId: string;
  priceId: string;
  customerEmail: string;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, string>;
  locale?: string;
}

/**
 * Result of creating a checkout session
 */
export interface CheckoutResult {
  url: string;
  id: string;
}

/**
 * Parameters for creating a customer portal session
 */
export interface CreatePortalParams {
  customerId: string;
  returnUrl?: string;
  locale?: string;
}

/**
 * Result of creating a customer portal session
 */
export interface PortalResult {
  url: string;
}

/**
 * Payment providers (actual provider names from config)
 */
export type PaymentProviderName = Exclude<NonNullable<PaymentConfig['provider']>, ''>;

/**
 * Payment provider interface
 */
export interface PaymentProvider {
  /**
   * Get the provider's name
   */
  getProviderName(): string;

  /**
   * Create a checkout session
   */
  createCheckout(params: CreateCheckoutParams): Promise<CheckoutResult>;
  
  /**
   * Create a customer portal session
   */
  createCustomerPortal(params: CreatePortalParams): Promise<PortalResult>;

  /**
   * Handle webhook events
   */
  handleWebhookEvent(payload: string, signature: string): Promise<void>;
}
