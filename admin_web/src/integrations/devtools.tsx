import { TanStackDevtools } from '@tanstack/react-devtools';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import { TailwindIndicator } from '@/integrations/tailwindcss/tailwind-indicator';
import TanStackQueryDevtools from '@/integrations/tanstack-query/devtools';

/**
 * Dev-only tools: TanStack devtools + Tailwind breakpoint indicator.
 * Lazy-loaded in __root.tsx so none of this ships in production.
 */
export default function DevTools() {
  return (
    <>
      <TailwindIndicator />
      <TanStackDevtools
        config={{
          position: 'bottom-right',
        }}
        plugins={[
          {
            name: 'Tanstack Router',
            render: <TanStackRouterDevtoolsPanel />,
          },
          TanStackQueryDevtools,
        ]}
      />
    </>
  );
}
