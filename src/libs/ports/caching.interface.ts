/**
 * The caching contract, in domain language. It is deliberately the
 * intersection of what Redis, Valkey, Memcached and an in-process Map can all
 * do — Redis-only primitives (sorted sets, pipelines, SCAN) belong to a
 * different concern with a different port, not here.
 */
export interface CachingInterface {
  /** Resolves to undefined on a miss. */
  get<T>(key: string): Promise<T | undefined>;

  /** Omit ttlSeconds to use the driver's configured default. */
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
