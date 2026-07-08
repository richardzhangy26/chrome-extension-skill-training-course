import { userLlmConfig } from '@/db/app.schema';
import { llmConfigSchema, type LlmConfigInput } from '@/lib/llm-config-schema';
import { authApiMiddleware } from '@/middlewares/auth-middleware';
import { createServerFn } from '@tanstack/react-start';
import { eq } from 'drizzle-orm';

/** 读取某用户的 LLM 配置；无记录返回 null。 */
export async function readUserLlmConfig(userId: string): Promise<LlmConfigInput | null> {
  const { getDb } = await import('@/db');
  const db = getDb();
  const [row] = await db
    .select({ config: userLlmConfig.config })
    .from(userLlmConfig)
    .where(eq(userLlmConfig.userId, userId))
    .limit(1);
  if (!row) {
    return null;
  }
  // 容错：库里坏数据时返回 null 而非抛错。
  const parsed = llmConfigSchema.safeParse(JSON.parse(row.config));
  return parsed.success ? parsed.data : null;
}

/** upsert 某用户的 LLM 配置（按 userId 唯一）。 */
export async function writeUserLlmConfig(userId: string, config: LlmConfigInput): Promise<void> {
  const { getDb } = await import('@/db');
  const db = getDb();
  const now = new Date();
  const serialized = JSON.stringify(config);
  await db
    .insert(userLlmConfig)
    .values({
      id: crypto.randomUUID(),
      userId,
      config: serialized,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userLlmConfig.userId,
      set: { config: serialized, updatedAt: now },
    });
}

// 网页仅供查看配置，编辑入口在插件；写入由 bearer 的
// POST /api/extension/config 经 writeUserLlmConfig 完成，此处不再暴露 cookie 侧保存。
export const getMyLlmConfig = createServerFn({ method: 'GET' })
  .middleware([authApiMiddleware])
  .handler(async ({ context }) => {
    const config = await readUserLlmConfig(context.userId);
    return { config };
  });
