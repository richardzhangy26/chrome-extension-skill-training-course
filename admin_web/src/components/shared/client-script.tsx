import { useEffect } from 'react';

/**
 * Injects a script into document.head on the client.
 *
 * IMPORTANT: injection is deferred until the browser is idle (via
 * requestIdleCallback, with setTimeout fallback). This keeps analytics /
 * chat scripts from competing with the LCP hero image and
 * initial React hydration — critical for Core Web Vitals on a content-heavy
 * landing page.
 */
export function ClientScript({
  src,
  async: asyncAttr,
  defer,
  id,
  dataAttributes,
  inlineHtml,
}: {
  src?: string;
  async?: boolean;
  defer?: boolean;
  id?: string;
  dataAttributes?: Record<string, string>;
  inlineHtml?: string;
}) {
  useEffect(() => {
    if (!import.meta.env.PROD) return;

    let script: HTMLScriptElement | null = null;
    let cancel: (() => void) | null = null;

    const inject = () => {
      script = document.createElement('script');
      if (id) script.id = id;
      if (src) script.src = src;
      if (asyncAttr) script.async = true;
      if (defer) script.defer = true;
      if (inlineHtml) script.textContent = inlineHtml;
      if (dataAttributes) {
        for (const [key, value] of Object.entries(dataAttributes)) {
          script.setAttribute(
            `data-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`,
            value
          );
        }
      }
      document.head.appendChild(script);
    };

    // Prefer requestIdleCallback so injection happens after LCP/FID budget;
    // fall back to a short setTimeout for Safari which lacks the API.
    type RIC = (cb: () => void, opts?: { timeout?: number }) => number;
    const ric = (window as unknown as { requestIdleCallback?: RIC })
      .requestIdleCallback;
    if (typeof ric === 'function') {
      const handle = ric(inject, { timeout: 3000 });
      cancel = () => {
        const cic = (
          window as unknown as {
            cancelIdleCallback?: (h: number) => void;
          }
        ).cancelIdleCallback;
        cic?.(handle);
      };
    } else {
      const handle = window.setTimeout(inject, 1500);
      cancel = () => window.clearTimeout(handle);
    }

    return () => {
      cancel?.();
      if (script?.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);
  return null;
}
