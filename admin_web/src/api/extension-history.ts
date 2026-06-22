import { userAgentLog } from '@/db/app.schema';
import { agentLogSessionSchema, type AgentLogSessionInput, type Tombstone } from '@/lib/agent-log-schema';
import { authApiMiddleware } from '@/middlewares/auth-middleware';
import { createServerFn } from '@tanstack/react-start';
import { and, eq } from 'drizzle-orm';

/** 读取某用户的历史：active 行回 session，tombstone 行回 {sessionId, deletedAt}。 */
export async function readUserHistory(
  userId: string,
): Promise<{ sessions: AgentLogSessionInput[]; tombstones: Tombstone[] }> {
  const { getDb } = await import('@/db');
  const db = getDb();
  const rows = await db.select().from(userAgentLog).where(eq(userAgentLog.userId, userId));

  const sessions: AgentLogSessionInput[] = [];
  const tombstones: Tombstone[] = [];
  for (const row of rows) {
    if (row.deletedAt) {
      tombstones.push({ sessionId: row.sessionId, deletedAt: row.deletedAt.getTime() });
    } else if (row.session) {
      // 容错：库里坏数据时跳过该条而非整体抛错。
      const parsed = agentLogSessionSchema.safeParse(JSON.parse(row.session));
      if (parsed.success) {
        sessions.push(parsed.data);
      }
    }
  }
  return { sessions, tombstones };
}

/**
 * upsert 某用户的历史（按 (userId, sessionId)）。
 * LWW：active 行仅当传入 updatedAt >= 现有才覆盖；
 * tombstone 行仅当传入 updatedAt > deletedAt 才复活（清 deletedAt），否则保持 tombstone。
 */
export async function upsertUserHistory(userId: string, sessions: AgentLogSessionInput[]): Promise<void> {
  const { getDb } = await import('@/db');
  const db = getDb();
  const now = new Date();

  for (const session of sessions) {
    const incoming = session.updatedAt;
    const [existing] = await db
      .select({ updatedAt: userAgentLog.updatedAt, deletedAt: userAgentLog.deletedAt })
      .from(userAgentLog)
      .where(and(eq(userAgentLog.userId, userId), eq(userAgentLog.sessionId, session.id)))
      .limit(1);

    if (existing) {
      const existingDeleted = existing.deletedAt ? existing.deletedAt.getTime() : null;
      if (existingDeleted !== null) {
        if (incoming <= existingDeleted) {
          continue; // tombstone 胜，忽略陈旧/等时间戳上传，防复活
        }
      } else if (incoming < existing.updatedAt.getTime()) {
        continue; // 旧值，忽略
      }
      await db
        .update(userAgentLog)
        .set({ session: JSON.stringify(session), updatedAt: new Date(incoming), deletedAt: null })
        .where(and(eq(userAgentLog.userId, userId), eq(userAgentLog.sessionId, session.id)));
    } else {
      await db.insert(userAgentLog).values({
        id: crypto.randomUUID(),
        userId,
        sessionId: session.id,
        session: JSON.stringify(session),
        updatedAt: new Date(incoming),
        deletedAt: null,
        createdAt: now,
      });
    }
  }
}

/** 软删：置 deletedAt、清 session 体；云端不存在的 sessionId 影响 0 行（无害）。 */
export async function deleteUserHistory(userId: string, sessionIds: string[]): Promise<void> {
  if (sessionIds.length === 0) {
    return;
  }
  const { getDb } = await import('@/db');
  const db = getDb();
  const now = new Date();
  for (const sessionId of sessionIds) {
    await db
      .update(userAgentLog)
      .set({ deletedAt: now, session: null })
      .where(and(eq(userAgentLog.userId, userId), eq(userAgentLog.sessionId, sessionId)));
  }
}

/** 网页只读查看：返回本人 active 历史（不含 tombstone）。 */
export const getMyHistory = createServerFn({ method: 'GET' })
  .middleware([authApiMiddleware])
  .handler(async ({ context }) => {
    const { sessions } = await readUserHistory(context.userId);
    return { sessions };
  });
