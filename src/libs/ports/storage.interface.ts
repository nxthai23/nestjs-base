import { Readable } from 'stream';

export interface PutObjectInput {
  key: string;
  body: Buffer | Readable;
  contentType?: string;
}

/**
 * Object storage contract. Implemented by adapters in `src/libs/adapters`,
 * consumed through `StorageService` — never imported from an adapter directly.
 */
export interface StorageInterface {
  putObject(input: PutObjectInput): Promise<{ key: string }>;
  deleteObject(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
}

export class StorageError extends Error {
  constructor(
    readonly operation: string,
    readonly key: string,
    readonly cause?: unknown,
  ) {
    super(`Storage ${operation} failed for key "${key}"`);
    this.name = 'StorageError';
  }
}

/** See CACHING_DEFAULTS: one definition, referenced by config and by module. */
export const STORAGE_DEFAULTS = {
  driver: 's3',
  /**
   * Bytes per multipart part. 5 MB is the protocol minimum for every part but
   * the last, and also the SDK's own default.
   */
  partSizeBytes: 5 * 1024 * 1024,
  /**
   * Parts in flight at once. The uploader holds at most
   * `uploadConcurrency * partSizeBytes` in memory - 20 MB at these defaults.
   */
  uploadConcurrency: 4,
} as const;
