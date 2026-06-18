import { createServerFn } from '@tanstack/react-start';
import type { User } from '@/db/types';
import { adminApiMiddleware } from '@/middlewares/admin-middleware';
import { getDb } from '@/db';
import { user } from '@/db/auth.schema';
import {
  and,
  asc,
  count as countFn,
  desc,
  eq,
  isNull,
  or,
  sql,
} from 'drizzle-orm';
import { z } from 'zod';

const SORT_FIELD_MAP: Record<
  string,
  typeof user.name | typeof user.email | typeof user.createdAt
> = {
  name: user.name,
  email: user.email,
  createdAt: user.createdAt,
};

function normalizeSortId(raw: string): 'name' | 'email' | 'createdAt' {
  const s = (raw ?? 'createdAt').trim();
  if (s.toLowerCase() === 'name') return 'name';
  if (s.toLowerCase() === 'email') return 'email';
  return 'createdAt';
}

const listUsersInputSchema = z.object({
  pageIndex: z.number().int().min(0),
  pageSize: z.number().int().min(1).max(100),
  search: z.string(),
  sortId: z.string(),
  sortDesc: z.boolean(),
  role: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export const listUsers = createServerFn({ method: 'GET' })
  .inputValidator(listUsersInputSchema)
  .middleware([adminApiMiddleware])
  .handler(async ({ data }) => {
    const db = getDb();
    const { pageIndex, pageSize, search, sortDesc, role, status } = data;
    const offset = pageIndex * pageSize;
    const sortId = normalizeSortId(data.sortId);

    const conditions = [];
    if (search.trim()) {
      const escaped = search
        .replace(/\\/g, '\\\\')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_');
      const pattern = `%${escaped}%`;
      conditions.push(
        or(
          sql`lower(${user.name}) like lower(${pattern})`,
          sql`lower(${user.email}) like lower(${pattern})`
        )!
      );
    }
    if (role?.trim()) {
      conditions.push(eq(user.role, role.trim()));
    }
    if (status === 'active') {
      conditions.push(or(eq(user.banned, false), isNull(user.banned))!);
    } else if (status === 'inactive') {
      conditions.push(eq(user.banned, true));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const sortField = SORT_FIELD_MAP[sortId] ?? user.createdAt;
    const sortDirection = sortDesc ? desc : asc;

    const selectQuery = db
      .select()
      .from(user)
      .where(where)
      .orderBy(sortDirection(sortField))
      .limit(pageSize)
      .offset(offset);
    const countQuery = db.select({ count: countFn() }).from(user).where(where);

    const [items, [{ count }]] = await Promise.all([selectQuery, countQuery]);

    return {
      items: items.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        emailVerified: row.emailVerified,
        image: row.image,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        role: row.role,
        banned: row.banned,
        banReason: row.banReason,
        banExpires: row.banExpires,
      })) as User[],
      total: Number(count),
    };
  });
