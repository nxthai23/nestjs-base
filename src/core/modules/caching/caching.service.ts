import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CachingInterface,
  NamespacedCache,
} from '@libs/ports/caching.interface';
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
 *
 * It also owns the keyspace. Every key passes through `qualify`, which is
 * where the deployment-wide prefix is applied, and `namespace` hands out a
 * view confined to one part of it. Feature code should take a namespace rather
 * than write raw keys: the cache is a single shared map, and two features that
 * pick the same identifier - a wallet address, a user id - otherwise overwrite
 * each other with nothing to warn them.
 */
@Injectable()
export class CachingService implements CachingInterface {
  private readonly logger = new Logger(CachingService.name);

  /** Prepended to every key. Empty unless CACHE_KEY_PREFIX is configured. */
  private readonly prefix: string;

  constructor(
    @Inject(CACHING_ADAPTER) private readonly adapter: CachingInterface,
    config: ConfigService,
  ) {
    const configured = config.get<string>('caching.keyPrefix', '').trim();
    this.prefix = configured ? `${configured.replace(/:+$/, '')}:` : '';
  }

  /**
   * A view of the cache whose keys all sit under `name`.
   *
   * Prefer this to calling the facade directly. Holding a namespace makes the
   * collision impossible rather than merely unlikely, and it keeps the naming
   * convention in one place instead of at every call site.
   */
  namespace(name: string): NamespacedCache {
    const scope = `${name}:`;

    // Delegating through the public methods rather than the adapter keeps
    // fail-open, the global prefix and the undefined handling in one place.
    return {
      get: <T>(key: string) => this.get<T>(scope + key),
      set: <T>(key: string, value: T, ttlSeconds?: number) =>
        this.set(scope + key, value, ttlSeconds),
      delete: (key: string) => this.delete(scope + key),
      has: (key: string) => this.has(scope + key),
    };
  }

  get<T>(key: string): Promise<T | undefined> {
    const qualified = this.qualify(key);
    return this.degrade(
      'get',
      qualified,
      () => this.adapter.get<T>(qualified),
      undefined,
    );
  }

  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    // `undefined` cannot survive the round trip: JSON.stringify returns the
    // value undefined rather than a string, which leaves the memory driver
    // holding a non-string it later fails to parse. It is unreadable anyway,
    // since `get` spends undefined on "miss" - so removing the key is the only
    // reading of set(key, undefined) that stays consistent with the port.
    if (value === undefined) {
      // Unqualified: delete does its own qualifying.
      return this.delete(key);
    }

    const qualified = this.qualify(key);
    return this.degrade(
      'set',
      qualified,
      () => this.adapter.set(qualified, value, ttlSeconds),
      undefined,
    );
  }

  delete(key: string): Promise<void> {
    const qualified = this.qualify(key);
    return this.degrade(
      'delete',
      qualified,
      () => this.adapter.delete(qualified),
      undefined,
    );
  }

  has(key: string): Promise<boolean> {
    const qualified = this.qualify(key);
    return this.degrade(
      'has',
      qualified,
      () => this.adapter.has(qualified),
      false,
    );
  }

  clear(): Promise<void> {
    return this.degrade('clear', '*', () => this.adapter.clear(), undefined);
  }

  private qualify(key: string): string {
    return this.prefix + key;
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
