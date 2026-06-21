import { userFiles } from '@/db/app.schema';
import { getBaseUrl } from '@/lib/urls';
import { authApiMiddleware } from '@/middlewares/auth-middleware';
import { StorageError, UploadError } from '@/storage/types';
import { isPublicFolder } from '@/storage/utils';
import { createServerFn } from '@tanstack/react-start';
import { and, count, desc, eq } from 'drizzle-orm';
import { z } from 'zod';

const listSchema = z.object({
  pageIndex: z.number().int().min(0),
  pageSize: z.number().int().min(1).max(100),
});

export const listUserFiles = createServerFn({ method: 'GET' })
  .inputValidator(listSchema)
  .middleware([authApiMiddleware])
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { getDb } = await import('@/db');
    const pageIndex = data.pageIndex;
    const pageSize = data.pageSize;
    const db = getDb();
    const where = eq(userFiles.userId, userId);

    const [totalRow] = await db.select({ count: count() }).from(userFiles).where(where);
    const total = totalRow?.count ?? 0;

    const items = await db
      .select()
      .from(userFiles)
      .where(where)
      .orderBy(desc(userFiles.createdAt))
      .limit(pageSize)
      .offset(pageIndex * pageSize);

    return { items, total };
  });

const deleteSchema = z.object({ id: z.string() });

export const deleteUserFile = createServerFn({ method: 'POST' })
  .inputValidator(deleteSchema)
  .middleware([authApiMiddleware])
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const [{ getDb }, { deleteFile }] = await Promise.all([import('@/db'), import('@/storage')]);
    const db = getDb();
    const [row] = await db
      .select()
      .from(userFiles)
      .where(and(eq(userFiles.id, data.id), eq(userFiles.userId, userId)))
      .limit(1);

    if (!row) {
      throw new Error('File not found');
    }

    await deleteFile(row.r2Key);
    await db.delete(userFiles).where(eq(userFiles.id, data.id));
  });

const uploadSchema = z
  .custom<FormData>((v): v is FormData => v instanceof FormData)
  .transform(fd => {
    const file = fd.get('file');
    if (!file || !(file instanceof File)) {
      throw new Error('File not provided');
    }
    const folderRaw = fd.get('folder');
    const folder = typeof folderRaw === 'string' ? folderRaw : undefined;
    const isPublicRaw = fd.get('isPublic');
    const isPublic = typeof isPublicRaw === 'string' ? isPublicRaw === 'true' : undefined;
    const descriptionRaw = fd.get('description');
    const description = typeof descriptionRaw === 'string' && descriptionRaw !== '' ? descriptionRaw : undefined;
    return {
      file,
      folder,
      isPublic,
      description,
    };
  });

export const uploadUserFile = createServerFn({ method: 'POST' })
  .inputValidator(uploadSchema)
  .middleware([authApiMiddleware])
  .handler(async ({ data, context }) => {
    const { userId } = context;
    try {
      const [{ getDb }, { uploadFile }] = await Promise.all([import('@/db'), import('@/storage')]);
      const buffer = Buffer.from(await data.file.arrayBuffer());
      const requestOrigin = getBaseUrl();
      const publicFolder = isPublicFolder(data.folder);

      // Public folders (avatars, product logos/og-images) are shared resources:
      // no userId → stored directly under folder → no userFiles DB record.
      // Private files get userId scoping and are tracked in userFiles.
      const result = await uploadFile(buffer, data.file.name, data.file.type, {
        folder: data.folder,
        userId: publicFolder ? undefined : (userId ?? undefined),
        requestOrigin,
      });

      // Only user-scoped uploads produce metadata; record them in DB
      if (!publicFolder && userId && result.metadata) {
        const db = getDb();
        const now = result.metadata.uploadedAt;
        await db.insert(userFiles).values({
          id: result.metadata.id,
          userId,
          filename: result.metadata.filename,
          originalName: result.metadata.originalName,
          contentType: result.metadata.contentType,
          size: result.metadata.size,
          r2Key: result.metadata.r2Key,
          createdAt: now,
          updatedAt: now,
          isPublic: data.isPublic ?? null,
          description: data.description ?? null,
        });
      }

      return result;
    } catch (error) {
      if (error instanceof UploadError || error instanceof StorageError) {
        throw new Error(error.message);
      }
      throw new Error('Something went wrong while uploading the file');
    }
  });
