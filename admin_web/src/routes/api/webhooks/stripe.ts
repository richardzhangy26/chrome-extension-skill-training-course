import { createFileRoute } from '@tanstack/react-router';

/**
 * Stripe webhook endpoint
 * Configure in Stripe Dashboard: Webhooks -> Add endpoint
 * Endpoint URL: https://your-domain.com/api/webhooks/stripe
 * Events: checkout.session.completed, customer.subscription.*, invoice.paid
 */
export const Route = createFileRoute('/api/webhooks/stripe')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleWebhookEvent, isPaymentEnabled } = await import('@/payment');
        if (!isPaymentEnabled()) {
          return Response.json({ received: true }, { status: 200 });
        }
        const payload = await request.text();
        const signature = request.headers.get('stripe-signature') ?? '';
        if (!payload || !signature) {
          console.warn('Stripe webhook: missing payload or signature');
          return Response.json({ error: 'Missing payload or signature' }, { status: 400 });
        }
        try {
          await handleWebhookEvent(payload, signature);
          return Response.json({ received: true }, { status: 200 });
        } catch (err) {
          console.error('Stripe webhook error:', err);
          // CRITICAL: Return 200 even on error to prevent Stripe infinite retries
          // Stripe interprets 4xx/5xx as processing failure and will retry indefinitely
          // We've already logged the error for debugging
          return Response.json({ error: 'Webhook processing failed', received: true }, { status: 200 });
        }
      },
    },
  },
});
