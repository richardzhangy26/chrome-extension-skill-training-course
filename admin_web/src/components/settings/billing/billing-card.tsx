import { m } from '@/locale/paraglide/messages';
import { CustomerPortalButton } from '@/components/pricing/customer-portal-button';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { authClient } from '@/auth/client';
import { formatDate } from '@/lib/formatter';
import { cn } from '@/lib/utils';
import { useCurrentPlan } from '@/hooks/use-payment';
import { getPricePlans } from '@/lib/price-plan';
import { Link } from '@tanstack/react-router';
import { Routes } from '@/lib/routes';
import { IconCircleCheck, IconClock, IconRefresh } from '@tabler/icons-react';
import { useCallback } from 'react';
/** Card container: full width, no bottom padding */
const cardClass = cn('w-full overflow-hidden pt-6 pb-0 flex flex-col');
/** Footer: right-aligned primary action, muted background */
const footerClass = cn(
  'mt-2 px-6 py-4 flex justify-end items-center bg-muted rounded-none'
);
/**
 * Billing card: current plan and subscription status
 */
export function BillingCard() {
  const { data: session, isPending: isLoadingSession } =
    authClient.useSession();
  const currentUser = session?.user;
  const {
    data: paymentData,
    isLoading: isLoadingPayment,
    error: loadPaymentError,
    refetch: refetchPayment,
  } = useCurrentPlan(!!currentUser?.id);
  const currentPlan = paymentData?.currentPlan ?? null;
  const subscription = paymentData?.subscription ?? null;
  const isLifetimeMember = currentPlan?.isLifetime ?? false;
  // Resolve display name from config (fallback to plan id or "Free")
  const plansRecord = getPricePlans();
  const plans = Object.values(plansRecord);
  const currentPlanWithName = currentPlan
    ? (plans.find((p) => p.id === currentPlan.id) ?? currentPlan)
    : null;
  const isFreePlan = currentPlanWithName?.isFree ?? false;
  const currentPeriodStart = subscription?.currentPeriodStart
    ? formatDate(subscription.currentPeriodStart)
    : null;
  const currentPeriodEnd = subscription?.currentPeriodEnd
    ? formatDate(subscription.currentPeriodEnd)
    : null;
  const trialEndDate = subscription?.trialEndDate
    ? formatDate(subscription.trialEndDate)
    : null;
  const handleRetry = useCallback(() => refetchPayment(), [refetchPayment]);
  // Loading: skeleton for header, content and footer (footer button area right-aligned)
  if (isLoadingPayment || isLoadingSession) {
    return (
      <Card className={cardClass}>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            {m.settings_billing_card_current_plan()}
          </CardTitle>
          <CardDescription>
            {m.settings_billing_card_current_plan_description()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 flex-1">
          <div className="flex items-center justify-start space-x-4">
            <Skeleton className="h-8 w-1/5" />
          </div>
          <div className="text-sm text-muted-foreground space-y-2">
            <Skeleton className="h-6 w-3/5" />
          </div>
        </CardContent>
        <CardFooter className={footerClass}>
          <Skeleton className="h-8 w-1/4" />
        </CardFooter>
      </Card>
    );
  }
  // Error: show message in content and retry button in footer (right-aligned)
  if (loadPaymentError) {
    return (
      <Card className={cardClass}>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            {m.settings_billing_card_current_plan()}
          </CardTitle>
          <CardDescription>
            {m.settings_billing_card_current_plan_description()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 flex-1">
          <div className="text-destructive text-sm">
            {loadPaymentError?.message}
          </div>
        </CardContent>
        <CardFooter className={footerClass}>
          <Button variant="outline" onClick={handleRetry}>
            <IconRefresh className="size-4 mr-1" />
            {m.settings_billing_card_retry()}
          </Button>
        </CardFooter>
      </Card>
    );
  }
  // No plan: show noPlan message and upgrade CTA in footer (right-aligned)
  if (!currentPlanWithName) {
    return (
      <Card className={cardClass}>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            {m.settings_billing_card_current_plan()}
          </CardTitle>
          <CardDescription>
            {m.settings_billing_card_current_plan_description()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            {m.settings_billing_card_no_plan()}
          </div>
        </CardContent>
        <CardFooter className={footerClass}>
          <Link
            to={Routes.Pricing}
            className={buttonVariants({ variant: 'default' })}
          >
            {m.settings_billing_card_upgrade_plan()}
          </Link>
        </CardFooter>
      </Card>
    );
  }
  // Main state: plan name, status badge, period/trial info, single primary action in footer
  return (
    <Card className={cardClass}>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          {m.settings_billing_card_current_plan()}
        </CardTitle>
        <CardDescription>
          {m.settings_billing_card_current_plan_description()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 flex-1">
        {/* Plan name and status badge (trialing | active) */}
        <div className="flex items-center justify-start space-x-4">
          <div className="text-3xl font-medium">
            {currentPlanWithName?.name ??
              currentPlan?.id ??
              m.settings_billing_card_free()}
          </div>
          {subscription &&
            (subscription.status === 'trialing' ||
              subscription.status === 'active') && (
              <Badge
                variant="outline"
                className={cn(
                  'text-xs border-transparent',
                  subscription.status === 'trialing'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                    : 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                )}
              >
                {subscription.status === 'trialing' ? (
                  <span className="flex items-center space-x-2">
                    <IconClock className="size-3 mr-1" />
                    {m.settings_billing_card_status_trial()}
                  </span>
                ) : (
                  <span className="flex items-center space-x-2">
                    <IconCircleCheck className="size-3 mr-1" />
                    {m.settings_billing_card_status_active()}
                  </span>
                )}
              </Badge>
            )}
        </div>

        {/* Free plan hint */}
        {isFreePlan && (
          <div className="text-sm text-muted-foreground">
            {m.settings_billing_card_free_plan_message()}
          </div>
        )}

        {/* Lifetime plan hint */}
        {isLifetimeMember && (
          <div className="text-sm text-muted-foreground">
            {m.settings_billing_card_lifetime_message()}
          </div>
        )}

        {/* Subscription period and trial dates */}
        {subscription && (
          <div className="text-sm text-muted-foreground space-y-2">
            {currentPeriodStart && (
              <div className="text-muted-foreground">
                {m.settings_billing_card_period_start()} {currentPeriodStart}
              </div>
            )}
            {currentPeriodEnd && (
              <div className="text-muted-foreground">
                {m.settings_billing_card_period_ends()} {currentPeriodEnd}
                {subscription.cancelAtPeriodEnd &&
                  ` ${m.settings_billing_card_cancels_at_period_end()}`}
              </div>
            )}
            {subscription.status === 'trialing' && trialEndDate && (
              <div className="text-amber-600">
                {m.settings_billing_card_trial_ends()} {trialEndDate}
              </div>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className={footerClass}>
        {/* Free: show upgrade button */}
        {isFreePlan && (
          <Link
            to={Routes.Pricing}
            className={buttonVariants({ variant: 'default' })}
          >
            {m.settings_billing_card_upgrade_plan()}
          </Link>
        )}

        {/* Lifetime: show manage billing */}
        {isLifetimeMember && currentUser && (
          <CustomerPortalButton returnUrl={undefined}>
            {m.settings_billing_card_manage_billing()}
          </CustomerPortalButton>
        )}

        {/* Subscription: show manage subscription (only when not free and not lifetime) */}
        {!isFreePlan && !isLifetimeMember && currentUser && (
          <CustomerPortalButton returnUrl={undefined}>
            {m.settings_billing_card_manage_subscription()}
          </CustomerPortalButton>
        )}
      </CardFooter>
    </Card>
  );
}
