# Storage module

The storage module provides file upload (and optional delete) using **Cloudflare R2** via the Worker bucket binding. No environment variables are required for storage (see [Env](./env.md) for project env overview). No S3 SDK or third-party storage library is used—only the [Cloudflare R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/). It is used for avatar uploads (Settings → Profile) when enabled.

## Enabling storage (3 steps)

1. **Create the R2 bucket** (once per environment):

   ```bash
   npx wrangler r2 bucket create <BUCKET_NAME>
   ```

   Use the same name as `bucket_name` in `wrangler.jsonc` (e.g. `mkfast-template`).

2. **Configure the bucket in `wrangler.jsonc`**:

   ```jsonc
   "r2_buckets": [
     {
       "bucket_name": "mkfast-template",
       "binding": "FILES"
     }
   ]
   ```

   The Worker receives the bucket as `env.FILES`. No extra env vars are required for upload/serve.

3. **Enable storage in website config** (`src/config/website.ts`):

   ```ts
   storage: {
     enable: true,
     provider: 'r2',
     maxFileSize: 4 * 1024 * 1024,  // optional, default 4MB
     allowedTypes: ['.jpg', '.jpeg', '.png', '.webp'],  // optional
   },
   ```

   After this, the upload server function and avatar card are active. Returned file URLs use the same-origin proxy `/api/storage/file?key=...`.

## Directory structure

```
src/storage/
├── index.ts           # getR2Bucket, getStorageProvider, uploadFile, deleteFile, …
├── types.ts           # StorageConfig (provider options), R2BucketInterface, UploadFileResult, errors
└── provider/
    └── r2.ts          # getR2Bucket(), R2Provider (upload, delete, download, list, …)
```

## Configuration

- **websiteConfig.storage** (`src/config/website.ts`)
  - `enable`: Whether storage is enabled. When false, the upload API and avatar card are disabled.
  - `provider`: `'r2'`.
  - `maxFileSize`: Max file size in bytes (e.g. 4MB or 10MB). Used by upload validation and avatar card.
  - `allowedTypes`: Allowed file extensions (e.g. `['.jpg', '.jpeg', '.png', '.webp']`).
  - `userFilesFolder`: Parent folder for per-user files (e.g. `'userfiles'`); used by Settings → Files and upload API.

- **wrangler.jsonc**
  - `r2_buckets`: Bind the R2 bucket with `binding: "FILES"` (and `bucket_name`). `getR2Bucket()` in `provider/r2.ts` reads `env.FILES` and is exported from `@/storage`.

Files are always served via the same-origin route `/api/storage/file?key=...`.

## Core API

- **uploadFile(file, filename, contentType, folder?)** (server, in `@/storage`)
  - Uploads to R2; returns `Promise<{ url, key }>`. Used by the `uploadUserFile` server function.

- **deleteFile(key)** (server)
  - Deletes the object from R2. Used by `deleteUserFile` server function (e.g. Settings → Files, avatar cleanup).

- **uploadUserFile** (server function, in `@/api/user-files`): Accepts `FormData` (file, optional folder, isPublic, description). Requires session via `authApiMiddleware`. Validates file size and type, uploads to R2, optionally inserts into `userFiles` table; returns `{ url, key }`. Used by `useUploadUserFile()` and `useUploadUserAvatar()`.

- **useUploadUserAvatar()** (client, in `@/hooks/use-user-files`): Mutation that uploads a public file with `folder: 'avatars'` via `uploadUserFile`; returns `{ url, key }`. Used by the avatar upload card.

- **useUploadUserFile()** (client, in `@/hooks/use-user-files`): Mutation that uploads a user file via `uploadUserFile`; used by Settings → Files.

## API routes

- **GET /api/storage/file?key=...**
  - Streams the object from R2. Keys are unguessable (e.g. `avatars/<uuid>.<ext>`). Private files require session and ownership check.

Upload is implemented as a **server function** (`uploadUserFile` in `src/api/user-files.ts`), not an API route.

## Consumers

- **Settings → Profile** (`UpdateAvatarCard`): When `websiteConfig.storage.enable` is true, the user can upload an avatar; the client uses `useUploadUserAvatar()` (which calls `uploadUserFile`) then updates `user.image` with the returned URL.
- **Settings → Files**: List/delete/upload via server functions in `src/api/user-files.ts` (`listUserFiles`, `deleteUserFile`, `uploadUserFile`). Files are stored under `userFilesFolder`.

## Notes

- The R2 bucket is provided by the Worker binding only; no S3-style credentials or endpoint are used.
- For avatar use, the returned URL is stored in `user.image` (Better Auth). There is no separate file-metadata table in this project.
