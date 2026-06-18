import { websiteConfig } from '@/config/website';
import { R2Provider } from './provider/r2';
import type {
  FileMetadata,
  StorageProvider,
  StorageProviderName,
  UploadFileResult,
} from './types';

let storageProvider: StorageProvider | null = null;

type ProviderFactory = () => StorageProvider;

const providerRegistry: Record<StorageProviderName, ProviderFactory> = {
  r2: () => new R2Provider(),
};

function createProvider(): StorageProvider {
  const name = websiteConfig.storage?.provider;
  if (!name) throw new Error('storage.provider is required in websiteConfig.');
  const factory = providerRegistry[name as StorageProviderName];
  if (!factory) {
    throw new Error(`Unsupported storage provider: ${name}.`);
  }
  return factory();
}

/**
 * Get the storage provider (lazy-initialized on first use).
 */
export function getStorageProvider(): StorageProvider {
  if (!storageProvider) storageProvider = createProvider();
  return storageProvider;
}

export const uploadFile = async (
  file: Buffer | Blob | File,
  filename: string,
  contentType: string,
  options?: { folder?: string; userId?: string; requestOrigin?: string }
): Promise<UploadFileResult> => {
  const provider = getStorageProvider();
  return provider.uploadFile({
    file,
    filename,
    contentType,
    folder: options?.folder,
    userId: options?.userId,
    requestOrigin: options?.requestOrigin,
  });
};

export const deleteFile = async (key: string): Promise<void> => {
  const provider = getStorageProvider();
  return provider.deleteFile(key);
};

export const downloadFile = async (
  keyOrMetadata: string | FileMetadata
): Promise<ReadableStream | null> => {
  const provider = getStorageProvider();
  return provider.downloadFile(keyOrMetadata);
};

export const getFileInfo = async (
  key: string
): Promise<{ size?: number; contentType?: string } | null> => {
  const provider = getStorageProvider();
  return provider.getFileInfo(key);
};

export const getFile = async (
  key: string
): Promise<{ body: ReadableStream; contentType: string } | null> => {
  const provider = getStorageProvider();
  return provider.getFile(key);
};

export const listUserFiles = async (
  userId: string,
  options?: { limit?: number; cursor?: string }
) => {
  const provider = getStorageProvider();
  return provider.listUserFiles(userId, options);
};
