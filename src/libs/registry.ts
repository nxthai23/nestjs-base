import { S3Service } from './adapters/s3.service';
import { R2Service } from './adapters/r2.service';

/**
 * The only file allowed to import from `./adapters`. Everything else depends
 * on the port interfaces in `./ports` and receives an implementation through
 * NestJS DI. Adding a provider is a new adapter file plus one line here.
 */
export const registry = {
  storage: {
    s3: S3Service,
    r2: R2Service,
  },
} as const;

export type StorageDriver = keyof typeof registry.storage;
