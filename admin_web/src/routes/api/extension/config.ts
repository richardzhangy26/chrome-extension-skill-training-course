import { createFileRoute } from '@tanstack/react-router';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { auth } from '@/auth/auth';
import { readUserLlmConfig, writeUserLlmConfig } from '@/api/extension-config';
import { llmConfigSchema } from '@/lib/llm-config-schema';

const jsonResponse = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const requireUserId = async (): Promise<string | null> => {
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });
  if (!session?.user || !session.user.emailVerified) {
    return null;
  }
  return session.user.id;
};

export const Route = createFileRoute('/api/extension/config')({
  server: {
    handlers: {
      GET: async () => {
        const userId = await requireUserId();
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }
        const config = await readUserLlmConfig(userId);
        return jsonResponse({ config });
      },
      POST: async ({ request }) => {
        const userId = await requireUserId();
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }
        const parsed = llmConfigSchema.safeParse(await request.json());
        if (!parsed.success) {
          return jsonResponse({ error: 'Invalid config' }, 400);
        }
        await writeUserLlmConfig(userId, parsed.data);
        return jsonResponse({ ok: true });
      },
    },
  },
});
