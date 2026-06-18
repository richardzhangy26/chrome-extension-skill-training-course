import { websiteConfig } from '@/config/website';
import type { Price, PricePlan } from '@/payment/types';

/**
 * Get price plans from website config
 */
export const getPricePlans = (): Record<string, PricePlan> => {
  return (websiteConfig.payment?.price?.plans ?? {}) as Record<
    string,
    PricePlan
  >;
};

/**
 * Get all price plans as an array
 */
export function getAllPricePlans(): PricePlan[] {
  return Object.values(getPricePlans());
}

/**
 * Get plan by plan ID
 */
export function findPlanByPlanId(planId: string): PricePlan | undefined {
  return getAllPricePlans().find((plan) => plan.id === planId);
}

/**
 * Find plan by price ID
 */
export function findPlanByPriceId(priceId: string): PricePlan | undefined {
  const plans = getAllPricePlans();
  for (const plan of plans) {
    const matchingPrice = plan.prices.find((p) => p.priceId === priceId);
    if (matchingPrice) return plan;
  }
  return undefined;
}

/**
 * Find price by price ID and plan ID
 */
export function findPriceInPlan(
  planId: string,
  priceId: string
): Price | undefined {
  const plan = findPlanByPlanId(planId);
  if (!plan) return undefined;
  return plan.prices.find((p) => p.priceId === priceId);
}
