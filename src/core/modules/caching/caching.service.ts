import { Inject, Injectable, Logger } from '@nestjs/common';
import { CachingInterface } from '@libs/ports/caching.interface';
import { CACHING_ADAPTER } from './caching.constant';

/**
 * The caching entry point for the rest of the app.
 *
 * Unlike storage, this facade does more than delegate: it **fails open**. A
 * cache is an optimisation, and a miss is always a legal outcome — so when the
 * cache server is unreachable, requests get slower rather than returning 500.
 * Adapters still throw `CachingError`; turning that into a safe value is this
 * class's job, and the failure is logged so the outage stays visible somewhere.
 *
 * Consequence worth knowing: a broken cache is invisible in responses. The
 * cache health check is what surfaces it.
 */
@Injectable()
export class CachingService implements CachingInterface {
  private readonly logger = new Logger(CachingService.name);

  constructor(
    @Inject(CACHING_ADAPTER) private readonly adapter: CachingInterface,
  ) {}

  get<T>(key: string): Promise<T | undefined> {
    return this.degrade('get', key, () => this.adapter.get<T>(key), undefined);
  }

  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    // `undefined` cannot survive the round trip: JSON.stringify returns the
    // value undefined rather than a string, which leaves the memory driver
    // holding a non-string it later fails to parse. It is unreadable anyway,
    // since `get` spends undefined on "miss" - so removing the key is the only
    // reading of set(key, undefined) that stays consistent with the port.
    if (value === undefined) {
      return this.delete(key);
    }

    return this.degrade(
      'set',
      key,
      () => this.adapter.set(key, value, ttlSeconds),
      undefined,
    );
  }

  delete(key: string): Promise<void> {
    return this.degrade(
      'delete',
      key,
      () => this.adapter.delete(key),
      undefined,
    );
  }

  has(key: string): Promise<boolean> {
    return this.degrade('has', key, () => this.adapter.has(key), false);
  }

  clear(): Promise<void> {
    return this.degrade('clear', '*', () => this.adapter.clear(), undefined);
  }

  private async degrade<T>(
    operation: string,
    key: string,
    run: () => Promise<T>,
    fallback: T,
  ): Promise<T> {
    try {
      return await run();
    } catch (error) {
      this.logger.error(
        `Cache ${operation} failed for key "${key}" — continuing without cache`,
        error instanceof Error ? error.stack : String(error),
      );
      return fallback;
    }
  }
}
