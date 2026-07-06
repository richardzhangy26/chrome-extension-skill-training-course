import { createFileRoute } from '@tanstack/react-router';
import { readUserLlmConfig, writeUserLlmConfig } from '@/api/extension-config';
import { getVerifiedExtensionUserId } from '@/lib/extension-auth';
import { llmConfigSchema } from '@/lib/llm-config-schema';

const jsonResponse = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const Route = createFileRoute('/api/extension/config')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await getVerifiedExtensionUserId(request.headers);
        if (!auth.ok) {
          return jsonResponse(auth.body, auth.status);
        }
        const config = await readUserLlmConfig(auth.userId);
        return jsonResponse({ config });
      },
      POST: async ({ request }) => {
        const auth = await getVerifiedExtensionUserId(request.headers);
        if (!auth.ok) {
          return jsonResponse(auth.body, auth.status);
        }
        const parsed = llmConfigSchema.safeParse(await request.json());
        if (!parsed.success) {
          return jsonResponse({ error: 'Invalid config' }, 400);
        }
        await writeUserLlmConfig(auth.userId, parsed.data);
        return jsonResponse({ ok: true });
      },
    },
  },
});
