import { S3Service } from './adapters/s3.service';
import { R2Service } from './adapters/r2.service';
import { MemoryService } from './adapters/memory.service';
import { RedisService } from './adapters/redis.service';
import { ValkeyService } from './adapters/valkey.service';
import { MemcachedService } from './adapters/memcached.service';
import { LogMailService } from './adapters/log-mail.service';
import { SesService } from './adapters/ses.service';
import { SendgridService } from './adapters/sendgrid.service';

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
  caching: {
    memory: MemoryService,
    redis: RedisService,
    valkey: ValkeyService,
    memcached: MemcachedService,
  },
  mail: {
    log: LogMailService,
    ses: SesService,
    sendgrid: SendgridService,
  },
} as const;

export type StorageDriver = keyof typeof registry.storage;
export type CachingDriver = keyof typeof registry.caching;
export type MailDriver = keyof typeof registry.mail;

/**
 * Whether a driver name is actually registered.
 *
 * `group[driver]` on its own is not a membership test: a plain object answers
 * for everything on `Object.prototype`, so a driver named `constructor` or
 * `toString` resolves to something truthy and slips past a `!Adapter` guard.
 *
 * Spelled out rather than `Object.hasOwn`, which needs an es2022 lib.
 */
export function hasOwn<G extends object>(
  group: G,
  driver: PropertyKey,
): driver is keyof G {
  return Object.prototype.hasOwnProperty.call(group, driver);
}
