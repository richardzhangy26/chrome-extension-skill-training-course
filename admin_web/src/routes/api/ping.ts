import { createFileRoute } from '@tanstack/react-router';

/**
 * Health check endpoint for uptime monitoring.
 */
export const Route = createFileRoute('/api/ping')({
  server: {
    handlers: {
      GET: () => Response.json({ message: 'pong' }),
    },
  },
});
