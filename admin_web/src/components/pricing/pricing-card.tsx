import { m } from '@/locale/paraglide/messages';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { authClient } from '@/auth/client';
import { formatPrice } from '@/lib/formatter';
import { cn } from '@/lib/utils';
import type {
  PaymentType,
  PlanInterval,
  Price,
  PricePlan,
} from '@/payment/types';
import { PlanIntervals, PaymentTypes } from '@/payment/types';
import { IconCircleCheck, IconCircleX } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import { Badge } from '@/components/ui/badge';
import { CheckoutButton } from './create-checkout-button';
import { Routes } from '@/lib/routes';
function getPriceForPlan(
  plan: PricePlan,
  interval?: PlanInterval,
  paymentType?: PaymentType
): Price | undefined {
  if (plan.isFree) return undefined;
  return plan.prices.find((p) => {
    if (paymentType === PaymentTypes.ONE_TIME)
      return p.type === PaymentTypes.ONE_TIME;
    return p.type === PaymentTypes.SUBSCRIPTION && p.interval === interval;
  });
}
interface PricingCardProps {
  plan: PricePlan;
  interval?: PlanInterval;
  paymentType?: PaymentType;
  metadata?: Record<string, string>;
  className?: string;
  isCurrentPlan?: boolean;
}
export function PricingCard({
  plan,
  interval,
  paymentType,
  metadata,
  className,
  isCurrentPlan = false,
}: PricingCardProps) {
  const price = getPriceForPlan(plan, interval, paymentType);
  const { data: session } = authClient.useSession();
  const currentUser = session?.user;
  let formattedPrice = '';
  let priceLabel = '';
  if (plan.isFree) {
    formattedPrice = m.pricing_card_free();
  } else if (price && price.amount > 0) {
    formattedPrice = formatPrice(price.amount, price.currency);
    if (interval === PlanIntervals.MONTH)
      priceLabel = m.pricing_card_per_month();
    else if (interval === PlanIntervals.YEAR)
      priceLabel = m.pricing_card_per_year();
  } else {
    formattedPrice = m.pricing_card_not_available();
  }
  const isPaidPlan = !plan.isFree && !!price;
  const hasValidPriceId = !!price?.priceId?.trim();
  const hasTrialPeriod =
    price?.trialPeriodDays != null && price.trialPeriodDays > 0;
  return (
    <Card
      className={cn(
        'flex h-full flex-col',
        plan.popular && 'relative overflow-visible',
        className
      )}
    >
      {plan.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 transform">
          <Badge
            variant="default"
            className="bg-primary text-primary-foreground"
          >
            {m.pricing_card_popular()}
          </Badge>
        </div>
      )}

      <CardHeader>
        <CardTitle>
          <h3 className="font-medium">{plan.name ?? plan.id}</h3>
        </CardTitle>
        <div className="flex items-baseline gap-2">
          <span className="my-4 block text-4xl font-semibold">
            {formattedPrice}
          </span>
          {priceLabel && <span className="text-2xl">{priceLabel}</span>}
        </div>
        <CardDescription>
          <p className="text-sm">{plan.description ?? ''}</p>
        </CardDescription>

        {plan.isFree ? (
          currentUser ? (
            <Button variant="outline" className="mt-4 w-full" disabled>
              {m.pricing_card_get_started_for_free()}
            </Button>
          ) : (
            <Link
              to={Routes.Login}
              className={cn(
                buttonVariants({ variant: 'outline' }),
                'mt-4 w-full'
              )}
            >
              {m.pricing_card_get_started_for_free()}
            </Link>
          )
        ) : isCurrentPlan ? (
          <Button
            disabled
            className="mt-4 w-full border border-primary/20 bg-primary/10 text-primary hover:bg-primary/10 dark:border-primary/30 dark:bg-primary/15 dark:text-primary dark:hover:bg-primary/15"
          >
            {m.pricing_card_your_current_plan()}
          </Button>
        ) : isPaidPlan && price ? (
          currentUser && hasValidPriceId ? (
            <CheckoutButton
              planId={plan.id}
              priceId={price.priceId}
              metadata={metadata}
              className="mt-4 w-full"
            >
              {plan.isLifetime
                ? m.pricing_card_get_lifetime_access()
                : m.pricing_card_get_started()}
            </CheckoutButton>
          ) : currentUser && !hasValidPriceId ? (
            <Button disabled className="mt-4 w-full">
              {m.pricing_card_not_available()}
            </Button>
          ) : (
            <Link
              to={Routes.Login}
              className={cn(
                buttonVariants({ variant: 'default' }),
                'mt-4 w-full'
              )}
            >
              {m.pricing_card_get_started()}
            </Link>
          )
        ) : (
          <Button disabled className="mt-4 w-full">
            {m.pricing_card_not_available()}
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <hr className="border-dashed" />

        <ul className="list-outside space-y-4 text-sm">
          {plan.features?.map((feature, i) => (
            <li key={i} className="flex items-center gap-2">
              <IconCircleCheck className="size-4 text-chart-2" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        <ul className="list-outside space-y-4 text-sm">
          {plan.limits?.map((limit, i) => (
            <li key={i} className="flex items-center gap-2">
              <IconCircleX className="size-4 text-muted-foreground" />
              <span>{limit}</span>
            </li>
          ))}
        </ul>

        {hasTrialPeriod && price && (
          <div className="my-4">
            <span className="inline-block rounded-md border border-chart-2/20 bg-chart-2/10 px-2.5 py-1.5 text-xs font-medium text-chart-2 shadow-sm dark:border-chart-2/30 dark:bg-chart-2/15 dark:text-chart-2">
              {price.trialPeriodDays} {m.pricing_card_days_free_trial()}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
