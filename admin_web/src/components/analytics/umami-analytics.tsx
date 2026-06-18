import { ClientScript } from '@/components/shared/client-script';
import { clientEnv } from '@/env/client';

/**
 * Umami Analytics
 * https://umami.is
 */
export function UmamiAnalytics() {
  if (!import.meta.env.PROD) return null;
  const websiteId = clientEnv.VITE_UMAMI_WEBSITE_ID;
  const script = clientEnv.VITE_UMAMI_SCRIPT;
  if (!websiteId || !script) return null;

  return <ClientScript src={script} async dataAttributes={{ websiteId }} />;
}
