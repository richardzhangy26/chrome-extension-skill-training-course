import { useEffect, useRef } from 'react';
import { clientEnv } from '@/env/client';

/**
 * Crisp chat widget for customer support
 * https://crisp.chat/en/
 *
 * Perf: the Crisp SDK pulls ~100KB of JS + a websocket on load. We defer
 * initialization until the browser is idle (requestIdleCallback with a
 * setTimeout fallback) so it doesn't contend with the LCP hero image.
 * The SDK itself is also dynamically imported so it stays out of the
 * initial bundle.
 */
export function CrispChat() {
  const configured = useRef(false);

  useEffect(() => {
    const websiteId = clientEnv.VITE_CRISP_WEBSITE_ID;
    if (!websiteId || configured.current) {
      return;
    }

    const initCrisp = async () => {
      if (configured.current) return;
      try {
        const { Crisp } = await import('crisp-sdk-web');
        Crisp.configure(websiteId);
        configured.current = true;
      } catch (error) {
        console.error('Failed to initialize Crisp chat:', error);
      }
    };

    type RIC = (cb: () => void, opts?: { timeout?: number }) => number;
    const ric = (window as unknown as { requestIdleCallback?: RIC })
      .requestIdleCallback;
    if (typeof ric === 'function') {
      const handle = ric(() => void initCrisp(), { timeout: 4000 });
      return () => {
        const cic = (
          window as unknown as {
            cancelIdleCallback?: (h: number) => void;
          }
        ).cancelIdleCallback;
        cic?.(handle);
      };
    }

    const handle = window.setTimeout(() => void initCrisp(), 2000);
    return () => window.clearTimeout(handle);
  }, []);

  return null;
}
