import { env } from 'cloudflare:workers';
import {
  DEFAULT_ALLOWED_TYPES,
  DEFAULT_MAX_FILE_SIZE,
  DEFAULT_USER_FILES_FOLDER,
} from '../constants';
import {
  type FileMetadata,
  type R2BucketInterface,
  type StorageProvider,
  type UploadFileParams,
  type UploadFileResult,
  type ValidationResult,
  ConfigurationError,
  R2_ERROR_CODES,
  StorageError,
  UploadError,
} from '../types';
import { sanitizeFolder } from '../utils';
import { websiteConfig } from '@/config/website';

const success = <T>(data: T): ValidationResult<T> => ({ success: true, data });
const fail = (error: string, code?: string): ValidationResult<never> => ({
  success: false,
  error,
  code,
});

interface FileValidatorConfig {
  maxFileSize: number;
  allowedTypes: string[];
}

type FileValidator = ReturnType<typeof createFileValidator>;

/**
 * Create file validator from config. Pure function, easy to test and reuse.
 */
function createFileValidator(config: FileValidatorConfig) {
  const { maxFileSize, allowedTypes } = config;
  return {
    validateFile(
      file: File | Blob,
      originalName: string
    ): ValidationResult<true> {
      const size = file.size;
      if (size > maxFileSize) {
        const maxMB = Math.round(maxFileSize / (1024 * 1024));
        return fail(
          `${R2_ERROR_CODES.FILE_TOO_LARGE} (max ${maxMB}MB)`,
          'FILE_TOO_LARGE'
        );
      }
      if (allowedTypes.length > 0 && originalName) {
        const ext =
          originalName.lastIndexOf('.') === -1
            ? ''
            : originalName
                .slice(originalName.lastIndexOf('.') + 1)
                .toLowerCase();
        const normalized = allowedTypes.map((t: string) =>
          t.startsWith('.') ? t.slice(1).toLowerCase() : t.toLowerCase()
        );
        if (!ext || !normalized.includes(ext)) {
          const formatted = allowedTypes
            .map((t: string) => (t.startsWith('.') ? t : `.${t}`))
            .join(', ');
          return fail(
            `${R2_ERROR_CODES.INVALID_FILE_TYPE}. Supported: ${formatted}`,
            'INVALID_FILE_TYPE'
          );
        }
      }
      return success(true);
    },
  };
}

/**
 * Common MIME-type-to-extension mapping for content-type validation.
 * Only covers types typically allowed for user uploads.
 */
const MIME_TO_EXTENSIONS: Record<string, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/gif': ['gif'],
  'image/webp': ['webp'],
  'image/svg+xml': ['svg'],
  'image/bmp': ['bmp'],
  'image/x-icon': ['ico'],
  'application/pdf': ['pdf'],
  'text/plain': ['txt'],
  'text/csv': ['csv'],
  'application/json': ['json'],
  'application/zip': ['zip'],
  'application/gzip': ['gz'],
  'video/mp4': ['mp4'],
  'video/webm': ['webm'],
  'audio/mpeg': ['mp3'],
  'audio/wav': ['wav'],
  'application/msword': ['doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    'docx',
  ],
  'application/vnd.ms-excel': ['xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
};

/**
 * Validate that contentType is consistent with filename extension.
 * Prevents uploading e.g. text/html with a .jpg extension (stored XSS risk).
 */
function validateContentType(
  contentType: string,
  filename: string
): ValidationResult<true> {
  const ext = filename.includes('.')
    ? filename.slice(filename.lastIndexOf('.') + 1).toLowerCase()
    : '';
  if (!ext) return success(true); // no extension to cross-check

  const allowedExts = MIME_TO_EXTENSIONS[contentType.toLowerCase()];
  if (allowedExts && !allowedExts.includes(ext)) {
    return fail(
      `Content type '${contentType}' does not match file extension '.${ext}'`,
      'CONTENT_TYPE_MISMATCH'
    );
  }

  // Block dangerous MIME types regardless of extension
  const dangerousTypes = [
    'text/html',
    'application/javascript',
    'text/javascript',
    'application/x-httpd-php',
    'application/xhtml+xml',
  ];
  if (dangerousTypes.includes(contentType.toLowerCase())) {
    return fail(
      `Content type '${contentType}' is not allowed for uploads`,
      'DANGEROUS_CONTENT_TYPE'
    );
  }

  return success(true);
}

/**
 * Sanitize filename to prevent path traversal and keep storage key safe
 */
function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 255);
}

function generateId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Cloudflare R2 storage provider
 */
export class R2Provider implements StorageProvider {
  private readonly bucket: R2BucketInterface;
  private readonly userFilesFolder: string;
  private readonly validator: FileValidator;

  constructor() {
    this.bucket = env.BUCKET;
    if (!this.bucket) {
      throw new ConfigurationError(
        'R2 bucket binding BUCKET is not configured.'
      );
    }
    this.userFilesFolder =
      sanitizeFolder(websiteConfig.storage?.userFilesFolder) ??
      DEFAULT_USER_FILES_FOLDER;
    this.validator = createFileValidator({
      maxFileSize: websiteConfig.storage?.maxFileSize ?? DEFAULT_MAX_FILE_SIZE,
      allowedTypes:
        websiteConfig.storage?.allowedTypes ?? DEFAULT_ALLOWED_TYPES,
    });
  }

  getProviderName(): string {
    return 'r2';
  }

  private getBucket(): R2BucketInterface {
    return this.bucket;
  }

  /** Build same-origin proxy URL for a key */
  getPublicUrl(key: string, requestOrigin?: string): string {
    if (requestOrigin) {
      return `${requestOrigin}/api/storage/file?key=${encodeURIComponent(key)}`;
    }
    return key;
  }

  async uploadFile(params: UploadFileParams): Promise<UploadFileResult> {
    const { file, filename, contentType, folder, userId, requestOrigin } =
      params;
    const bucket = this.getBucket();

    const fileForValidation =
      file instanceof File
        ? file
        : new File(
            [file instanceof Blob ? file : new Uint8Array(file as Buffer)],
            filename,
            { type: contentType }
          );
    const validation = this.validator.validateFile(fileForValidation, filename);
    if (!validation.success) {
      throw new UploadError(validation.error);
    }

    const contentTypeValidation = validateContentType(contentType, filename);
    if (!contentTypeValidation.success) {
      throw new UploadError(contentTypeValidation.error);
    }

    const fileId = generateId();
    const sanitized = sanitizeFilename(filename);
    const storedFilename = `${fileId}-${sanitized}`;
    const sanitizedFolder = sanitizeFolder(folder);

    let r2Key: string;
    if (userId !== undefined) {
      if (sanitizedFolder) {
        r2Key = `${sanitizedFolder}/${userId}/${storedFilename}`;
      } else {
        r2Key = `${this.userFilesFolder}/${userId}/${storedFilename}`;
      }
    } else {
      r2Key = sanitizedFolder
        ? `${sanitizedFolder}/${storedFilename}`
        : storedFilename;
    }

    const body = file instanceof Blob ? file : new Uint8Array(file as Buffer);
    await bucket.put(r2Key, body, {
      httpMetadata: { contentType },
    });

    const url = this.getPublicUrl(r2Key, requestOrigin);

    const result: UploadFileResult = { url, key: r2Key };

    if (userId !== undefined) {
      const size = file instanceof Blob ? file.size : (file as Buffer).length;
      result.metadata = {
        id: fileId,
        userId,
        filename: storedFilename,
        originalName: filename,
        contentType,
        size,
        r2Key,
        uploadedAt: new Date(),
      };
    }

    return result;
  }

  async deleteFile(key: string): Promise<void> {
    try {
      const bucket = this.getBucket();
      await bucket.delete(key);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown error during file deletion';
      throw new StorageError(message);
    }
  }

  async downloadFile(
    keyOrMetadata: string | FileMetadata
  ): Promise<ReadableStream | null> {
    const key =
      typeof keyOrMetadata === 'string' ? keyOrMetadata : keyOrMetadata.r2Key;
    const bucket = this.getBucket();
    const object = await bucket.get(key);
    return object?.body ?? null;
  }

  async getFileInfo(
    key: string
  ): Promise<{ size?: number; contentType?: string } | null> {
    const bucket = this.getBucket();
    const head = await bucket.head(key);
    if (!head) return null;
    return {
      size: head.size,
      contentType: head.httpMetadata?.contentType,
    };
  }

  async getFile(
    key: string
  ): Promise<{ body: ReadableStream; contentType: string } | null> {
    const bucket = this.getBucket();
    const object = await bucket.get(key);
    if (!object?.body) return null;
    const contentType =
      object.httpMetadata?.contentType ?? 'application/octet-stream';
    return { body: object.body, contentType };
  }

  async listUserFiles(
    userId: string,
    options?: { limit?: number; cursor?: string }
  ): Promise<{
    objects: { key: string; size: number; uploaded: Date }[];
    nextCursor?: string;
    hasMore: boolean;
  }> {
    const bucket = this.getBucket();
    const prefix = `${this.userFilesFolder}/${userId}/`;
    const limit = Math.min(options?.limit ?? 50, 100);
    const listResult = await bucket.list({
      prefix,
      limit: limit + 1,
      cursor: options?.cursor,
    });

    const objects = listResult.objects ?? [];
    const hasMore = listResult.truncated ?? false;
    const nextCursor = listResult.cursor;
    const slice = hasMore ? objects.slice(0, limit) : objects;

    return {
      objects: slice.map((o) => ({
        key: o.key,
        size: o.size ?? 0,
        uploaded: o.uploaded ?? new Date(0),
      })),
      nextCursor: hasMore ? nextCursor : undefined,
      hasMore,
    };
  }
}
