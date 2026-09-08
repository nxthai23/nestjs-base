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
  /**
   * Uploads in a single request. For bodies the caller knows are small —
   * avatars, thumbnails, generated documents.
   *
   * The whole body goes out at once, so it is held in memory for the length of
   * the request, and the provider caps a single upload (5 GB on S3).
   */
  putObject(input: PutObjectInput): Promise<{ key: string }>;

  /**
   * Uploads in parts. For bodies that are large, or whose size is not known up
   * front — video, archives, anything streamed straight off a request.
   *
   * Memory stays bounded no matter the file size, a failed part is retried on
   * its own, and a failure that cannot be recovered aborts the upload rather
   * than leaving parts behind.
   *
   * Which of the two to call is the caller's decision: the code doing the
   * upload knows what it is uploading, and this layer does not. There is
   * deliberately no size threshold here choosing for it.
   */
  putLargeObject(input: PutObjectInput): Promise<{ key: string }>;
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
   * Bytes per part in `putLargeObject`. Not a threshold - nothing decides
   * between the two upload methods by size - just how finely that one chops
   * the body. 5 MB is the protocol minimum for every part but the last, and
   * also the SDK's own default.
   */
  partSizeBytes: 5 * 1024 * 1024,
  /**
   * Parts in flight at once. `putLargeObject` holds at most
   * `uploadConcurrency * partSizeBytes` in memory - 20 MB at these defaults.
   */
  uploadConcurrency: 4,
} as const;
