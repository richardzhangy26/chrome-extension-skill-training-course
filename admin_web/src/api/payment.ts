import { getDb } from '@/db';
import { payment } from '@/db/app.schema';
import { user } from '@/db/auth.schema';
import { getLocale } from '@/lib/locale';
import { findPlanByPriceId, getAllPricePlans } from '@/lib/price-plan';
import { Routes } from '@/lib/routes';
import { getCanonicalUrl } from '@/lib/urls';
import { authApiMiddleware } from '@/middlewares/auth-middleware';
import { createCheckout, createCustomerPortal } from '@/payment';
import type {
  PaymentStatus,
  PlanInterval,
  PricePlan,
  Subscription,
} from '@/payment/types';
import { PaymentScenes, PaymentTypes } from '@/payment/types';
import { websiteConfig } from '@/config/website';
import { createServerFn } from '@tanstack/react-start';
import { and, desc, eq, or } from 'drizzle-orm';
import { z } from 'zod';

const checkoutSchema = z.object({
  planId: z.string().min(1),
  priceId: z.string().min(1),
  successUrl: z.url().optional(),
  cancelUrl: z.url().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export const createCheckoutSession = createServerFn({ method: 'POST' })
  .inputValidator(checkoutSchema)
  .middleware([authApiMiddleware])
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const db = getDb();
    const [userRow] = await db
      .select({ email: user.email, name: user.name })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    if (!userRow?.email) throw new Error('User email not found');
    const { planId, priceId, successUrl, cancelUrl, metadata } = data;
    const locale = getLocale();
    const isCreem = websiteConfig.payment?.provider === 'creem';
    const billingUrl = getCanonicalUrl(Routes.SettingsBilling);
    const cancel = cancelUrl ?? billingUrl;

    // For Stripe: {CHECKOUT_SESSION_ID} is replaced by Stripe on redirect,
    // then the Payment page polls by sessionId until the webhook writes the DB record.
    // For Creem: Creem does NOT replace URL placeholders and has its own
    // payment confirmation page, so redirect straight to billing.
    const success = isCreem
      ? (successUrl ?? billingUrl)
      : (successUrl ??
        getCanonicalUrl(
          `${Routes.Payment}?session_id={CHECKOUT_SESSION_ID}&callback=${Routes.SettingsBilling}`
        ));
    const checkoutMetadata = {
      ...metadata,
      userId,
      userName: userRow.name ?? '',
    };

    const result = await createCheckout({
      planId,
      priceId,
      customerEmail: userRow.email,
      successUrl: success,
      cancelUrl: cancel,
      metadata: checkoutMetadata,
      locale,
    });
    return { url: result.url, id: result.id };
  });

const portalSchema = z.object({
  returnUrl: z.string().url().optional(),
  locale: z.string().optional(),
});

export const createCustomerPortalSession = createServerFn({ method: 'POST' })
  .inputValidator(portalSchema)
  .middleware([authApiMiddleware])
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const db = getDb();
    const [row] = await db
      .select({ customerId: user.customerId })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    if (!row?.customerId) {
      throw new Error('No customer found for user');
    }
    const locale = getLocale();
    const returnUrl = data.returnUrl ?? getCanonicalUrl(Routes.SettingsBilling);
    const result = await createCustomerPortal({
      customerId: row.customerId,
      returnUrl,
      locale: data.locale ?? locale,
    });
    return { url: result.url };
  });

export const getCurrentPlan = createServerFn({ method: 'GET' })
  .middleware([authApiMiddleware])
  .handler(async ({ context }) => {
    const { userId } = context;
    const db = getDb();
    const plans = getAllPricePlans();
    const freePlan = plans.find((p) => p.isFree && !p.disabled) ?? null;
    const lifetimePlanIds = plans.filter((p) => p.isLifetime).map((p) => p.id);

    const payments = await db
      .select({
        id: payment.id,
        priceId: payment.priceId,
        customerId: payment.customerId,
        type: payment.type,
        status: payment.status,
        scene: payment.scene,
        interval: payment.interval,
        periodStart: payment.periodStart,
        periodEnd: payment.periodEnd,
        cancelAtPeriodEnd: payment.cancelAtPeriodEnd,
        trialStart: payment.trialStart,
        trialEnd: payment.trialEnd,
        createdAt: payment.createdAt,
      })
      .from(payment)
      .where(
        and(
          eq(payment.paid, true),
          eq(payment.userId, userId),
          or(
            and(
              eq(payment.type, PaymentTypes.ONE_TIME),
              eq(payment.scene, PaymentScenes.LIFETIME),
              eq(payment.status, 'completed')
            ),
            and(
              eq(payment.type, PaymentTypes.SUBSCRIPTION),
              or(eq(payment.status, 'active'), eq(payment.status, 'trialing'))
            )
          )
        )
      )
      .orderBy(desc(payment.createdAt));

    let userLifetimePlan: PricePlan | null = null;
    let activeSubscription: Subscription | null = null;

    for (const rec of payments) {
      if (
        rec.type === PaymentTypes.ONE_TIME &&
        rec.scene === PaymentScenes.LIFETIME &&
        rec.status === 'completed' &&
        !userLifetimePlan
      ) {
        const plan = findPlanByPriceId(rec.priceId);
        if (plan && lifetimePlanIds.includes(plan.id)) {
          userLifetimePlan = plan as PricePlan;
        }
      }
      if (
        !userLifetimePlan &&
        rec.type === PaymentTypes.SUBSCRIPTION &&
        (rec.status === 'active' || rec.status === 'trialing') &&
        !activeSubscription
      ) {
        activeSubscription = {
          id: rec.id,
          priceId: rec.priceId,
          customerId: rec.customerId,
          status: rec.status as PaymentStatus,
          type: rec.type as 'subscription',
          interval: rec.interval as PlanInterval | undefined,
          currentPeriodStart: rec.periodStart ?? undefined,
          currentPeriodEnd: rec.periodEnd ?? undefined,
          cancelAtPeriodEnd: rec.cancelAtPeriodEnd ?? false,
          trialStartDate: rec.trialStart ?? undefined,
          trialEndDate: rec.trialEnd ?? undefined,
          createdAt: rec.createdAt,
        };
      }
    }

    if (userLifetimePlan) {
      return { currentPlan: userLifetimePlan, subscription: null };
    }
    if (activeSubscription) {
      const subscriptionPlan =
        plans.find((p) =>
          p.prices.some((pr) => pr.priceId === activeSubscription!.priceId)
        ) ?? null;
      return {
        currentPlan: subscriptionPlan as PricePlan | null,
        subscription: activeSubscription,
      };
    }
    return { currentPlan: freePlan as PricePlan | null, subscription: null };
  });

const checkCompletionSchema = z.object({ sessionId: z.string().min(1) });

/**
 * Check payment completion by Stripe session ID.
 * Used by Stripe flow where the session ID is embedded in the redirect URL.
 */
export const checkPaymentCompletion = createServerFn({ method: 'GET' })
  .inputValidator(checkCompletionSchema)
  .middleware([authApiMiddleware])
  .handler(async ({ data, context }) => {
    const db = getDb();
    const [record] = await db
      .select()
      .from(payment)
      .where(
        and(
          eq(payment.sessionId, data.sessionId),
          eq(payment.userId, context.userId)
        )
      )
      .limit(1);
    return { isPaid: !!record?.paid };
  });
