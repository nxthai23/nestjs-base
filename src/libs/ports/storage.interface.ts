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
  getPublicUrl(key: string): string;
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
