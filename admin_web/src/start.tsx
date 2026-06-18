import { createStart } from '@tanstack/react-start';

/**
 * TanStack Start instance
 * https://github.com/backpine/tanstack-start-on-cloudflare/blob/main/src/start.tsx
 */
declare module '@tanstack/react-start' {
  interface Register {
    server: {
      requestContext: {
        fromFetch: boolean;
      };
    };
  }
}

export const startInstance = createStart(() => {
  return {
    defaultSsr: true,
  };
});

startInstance.createMiddleware().server(({ next }) => {
  return next({
    context: {
      fromStartInstanceMw: true,
    },
  });
});
