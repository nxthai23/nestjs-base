/**
 * The caching contract, in domain language. It is deliberately the
 * intersection of what Redis, Valkey, Memcached and an in-process Map can all
 * do — Redis-only primitives (sorted sets, pipelines, SCAN) belong to a
 * different concern with a different port, not here.
 */
export interface CachingInterface {
  /** Resolves to undefined on a miss. */
  get<T>(key: string): Promise<T | undefined>;

  /**
   * Omit ttlSeconds to use the driver's configured default.
   *
   * `undefined` is not a storable value - `get` already uses it to mean
   * "miss", so a cached undefined would be indistinguishable from absence.
   * Setting it removes the key instead.
   */
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;

  delete(key: string): Promise<void>;

  has(key: string): Promise<boolean>;

  /**
   * Wipes everything the driver owns. On a shared Redis this is FLUSHDB and
   * clears the whole logical database, not just this app's keys — intended as
   * a test affordance.
   */
  clear(): Promise<void>;
}

/**
 * A view of the cache confined to one namespace. Keys handed to it are
 * qualified before they reach a driver, so two features cannot land on the
 * same key by picking the same identifier.
 *
 * `clear` is deliberately absent. Wiping one namespace means enumerating its
 * keys, and memcached has no SCAN - the port is the intersection of what every
 * driver can do, so offering it here would be a promise only some drivers keep.
 */
export type NamespacedCache = Omit<CachingInterface, 'clear'>;

export class CachingError extends Error {
  constructor(
    readonly operation: string,
    readonly key: string,
    readonly cause?: unknown,
  ) {
    super(`Caching ${operation} failed for key "${key}"`);
    this.name = 'CachingError';
  }
}
