import { m } from '@/locale/paraglide/messages';
import { createCheckoutSession } from '@/api/payment';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { IconLoader2 } from '@tabler/icons-react';
import { useState } from 'react';
import { toast } from 'sonner';
interface CheckoutButtonProps {
  planId: string;
  priceId: string;
  metadata?: Record<string, string>;
  variant?:
    | 'default'
    | 'outline'
    | 'destructive'
    | 'secondary'
    | 'ghost'
    | 'link'
    | null;
  size?: 'default' | 'sm' | 'lg' | 'icon' | null;
  className?: string;
  children?: React.ReactNode;
}
export function CheckoutButton({
  planId,
  priceId,
  metadata,
  variant = 'default',
  size = 'default',
  className,
  children,
}: CheckoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const handleClick = async () => {
    try {
      setIsLoading(true);
      // merge metadata with existing metadata
      const mergedMetadata = metadata ? { ...metadata } : {};
      const result = await createCheckoutSession({
        data: {
          planId,
          priceId,
          metadata:
            Object.keys(mergedMetadata).length > 0 ? mergedMetadata : undefined,
        },
      });
      if (result?.url) {
        window.location.href = result.url;
      } else {
        toast.error(m.pricing_checkout_failed());
      }
    } catch (err) {
      console.error('Checkout error:', err);
      toast.error(m.pricing_checkout_failed());
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <Button
      variant={variant}
      size={size}
      className={cn(className)}
      onClick={handleClick}
      disabled={isLoading}
    >
      {isLoading ? (
        <>
          <IconLoader2 className="mr-2 size-4 animate-spin" />
          {m.pricing_checkout_loading()}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
