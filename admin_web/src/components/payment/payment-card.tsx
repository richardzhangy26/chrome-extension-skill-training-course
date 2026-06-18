import { m } from '@/locale/paraglide/messages';
import { checkPaymentCompletion } from '@/api/payment';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  PAYMENT_MAX_POLL_TIME,
  PAYMENT_POLL_INTERVAL,
} from '@/payment/constants';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
  IconAlertCircle,
  IconCircleCheck,
  IconCircleX,
  IconLoader2,
} from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
type PaymentStatus = 'processing' | 'success' | 'failed' | 'timeout';
function getStatusContent(status: PaymentStatus): {
  title: string;
  description: string;
} {
  switch (status) {
    case 'processing':
      return {
        title: m.settings_payment_processing_title(),
        description: m.settings_payment_processing_description(),
      };
    case 'success':
      return {
        title: m.settings_payment_success_title(),
        description: m.settings_payment_success_description(),
      };
    case 'failed':
      return {
        title: m.settings_payment_failed_title(),
        description: m.settings_payment_failed_description(),
      };
    case 'timeout':
      return {
        title: m.settings_payment_timeout_title(),
        description: m.settings_payment_timeout_description(),
      };
    default:
      return { title: '', description: '' };
  }
}
function StatusIcon({ status }: { status: PaymentStatus }) {
  switch (status) {
    case 'processing':
      return (
        <IconLoader2 className="size-12 shrink-0 text-cyan-600 animate-spin" />
      );
    case 'success':
      return <IconCircleCheck className="size-12 shrink-0 text-green-600" />;
    case 'failed':
      return <IconCircleX className="size-12 shrink-0 text-red-600" />;
    case 'timeout':
      return <IconAlertCircle className="size-12 shrink-0 text-yellow-600" />;
    default:
      return (
        <IconLoader2 className="size-12 shrink-0 text-muted-foreground animate-spin" />
      );
  }
}
type PaymentCardProps = {
  sessionId: string | undefined;
  callback?: string;
};
/**
 * Payment result card: polls for completion, shows status, invalidates plan cache and redirects on success.
 */
export function PaymentCard({
  sessionId,
  callback = '/settings/billing',
}: PaymentCardProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<PaymentStatus>(() =>
    sessionId ? 'processing' : 'failed'
  );
  const pollEndRef = useRef(false);
  const startRef = useRef<number>(0);
  // Poll for payment completion
  useEffect(() => {
    if (!sessionId || status !== 'processing') return;
    pollEndRef.current = false;
    startRef.current = Date.now();
    const poll = async () => {
      while (
        !pollEndRef.current &&
        Date.now() - startRef.current < PAYMENT_MAX_POLL_TIME
      ) {
        try {
          const result = await checkPaymentCompletion({ data: { sessionId } });
          if (result?.isPaid) {
            setStatus('success');
            pollEndRef.current = true;
            return;
          }
        } catch {
          // continue polling
        }
        await new Promise((r) => setTimeout(r, PAYMENT_POLL_INTERVAL));
      }
      if (!pollEndRef.current) setStatus('timeout');
    };
    poll();
  }, [sessionId, status]);
  // On success: invalidate currentPlan then redirect to callback
  useEffect(() => {
    if (status !== 'success' || !callback) return;
    const run = async () => {
      await queryClient.invalidateQueries({ queryKey: ['currentPlan'] });
      await queryClient.refetchQueries({ queryKey: ['currentPlan'] });
      navigate({ to: callback });
    };
    run();
  }, [status, callback, queryClient, navigate]);
  const { title, description } = getStatusContent(status);
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="py-4 text-center">
          <div className="mb-8 flex justify-center">
            <StatusIcon status={status} />
          </div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
