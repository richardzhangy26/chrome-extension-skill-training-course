import { createFileRoute } from '@tanstack/react-router';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { z } from 'zod';
import { readUserHistory, upsertUserHistory, deleteUserHistory } from '@/api/extension-history';
import { agentLogSessionSchema } from '@/lib/agent-log-schema';

const jsonResponse = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const requireUserId = async (): Promise<string | null> => {
  const headers = getRequestHeaders();
  const { auth } = await import('@/auth/auth');
  const session = await auth.api.getSession({ headers });
  if (!session?.user || !session.user.emailVerified) {
    return null;
  }
  return session.user.id;
};

const postBodySchema = z.object({ sessions: z.array(agentLogSessionSchema) });
const deleteBodySchema = z.object({ sessionIds: z.array(z.string()) });

export const Route = createFileRoute('/api/extension/history')({
  server: {
    handlers: {
      GET: async () => {
        const userId = await requireUserId();
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }
        const data = await readUserHistory(userId);
        return jsonResponse(data);
      },
      POST: async ({ request }) => {
        const userId = await requireUserId();
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }
        const parsed = postBodySchema.safeParse(await request.json());
        if (!parsed.success) {
          return jsonResponse({ error: 'Invalid history' }, 400);
        }
        await upsertUserHistory(userId, parsed.data.sessions);
        return jsonResponse({ ok: true });
      },
      DELETE: async ({ request }) => {
        const userId = await requireUserId();
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }
        const parsed = deleteBodySchema.safeParse(await request.json());
        if (!parsed.success) {
          return jsonResponse({ error: 'Invalid sessionIds' }, 400);
        }
        await deleteUserHistory(userId, parsed.data.sessionIds);
        return jsonResponse({ ok: true });
      },
    },
  },
});
