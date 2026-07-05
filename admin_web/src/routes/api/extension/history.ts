import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { readUserHistory, upsertUserHistory, deleteUserHistory } from '@/api/extension-history';
import { getVerifiedExtensionUserId } from '@/lib/extension-auth';
import { agentLogSessionSchema } from '@/lib/agent-log-schema';

const jsonResponse = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const postBodySchema = z.object({ sessions: z.array(agentLogSessionSchema) });
const deleteBodySchema = z.object({ sessionIds: z.array(z.string()) });

export const Route = createFileRoute('/api/extension/history')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await getVerifiedExtensionUserId(request.headers);
        if (!auth.ok) {
          return jsonResponse(auth.body, auth.status);
        }
        const data = await readUserHistory(auth.userId);
        return jsonResponse(data);
      },
      POST: async ({ request }) => {
        const auth = await getVerifiedExtensionUserId(request.headers);
        if (!auth.ok) {
          return jsonResponse(auth.body, auth.status);
        }
        const parsed = postBodySchema.safeParse(await request.json());
        if (!parsed.success) {
          return jsonResponse({ error: 'Invalid history' }, 400);
        }
        await upsertUserHistory(auth.userId, parsed.data.sessions);
        return jsonResponse({ ok: true });
      },
      DELETE: async ({ request }) => {
        const auth = await getVerifiedExtensionUserId(request.headers);
        if (!auth.ok) {
          return jsonResponse(auth.body, auth.status);
        }
        const parsed = deleteBodySchema.safeParse(await request.json());
        if (!parsed.success) {
          return jsonResponse({ error: 'Invalid sessionIds' }, 400);
        }
        await deleteUserHistory(auth.userId, parsed.data.sessionIds);
        return jsonResponse({ ok: true });
      },
    },
  },
});
