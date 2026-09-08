import { Inject, Injectable } from '@nestjs/common';
import {
  PutObjectInput,
  StorageInterface,
} from '@libs/ports/storage.interface';
import { STORAGE_ADAPTER } from './storage.constant';

/**
 * The storage entry point for the rest of the app. Delegates to the adapter
 * chosen at boot, and is the single place to add behaviour that must apply to
 * every provider (retries, audit logging, key prefixing).
 */
@Injectable()
export class StorageService implements StorageInterface {
  constructor(
    @Inject(STORAGE_ADAPTER) private readonly adapter: StorageInterface,
  ) {}

  putObject(input: PutObjectInput): Promise<{ key: string }> {
    return this.adapter.putObject(input);
  }

  putLargeObject(input: PutObjectInput): Promise<{ key: string }> {
    return this.adapter.putLargeObject(input);
  }

  deleteObject(key: string): Promise<void> {
    return this.adapter.deleteObject(key);
  }

  exists(key: string): Promise<boolean> {
    return this.adapter.exists(key);
  }

  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string> {
    return this.adapter.getSignedUrl(key, expiresInSeconds);
  }
}
