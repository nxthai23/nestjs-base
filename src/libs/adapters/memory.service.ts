import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CACHING_DEFAULTS,
  CachingInterface,
} from '@libs/ports/caching.interface';

interface Entry {
  /** Serialized, so callers cannot mutate a cached value in place. */
  value: string;
  expiresAt: number;
}

/**
 * In-process cache. The default driver: it needs no credentials, so the
 * application boots and the e2e suite runs against the real implementation
 * rather than a mock.
 *
 * Entries are evicted lazily on read. Nothing schedules a timer, so this
 * cannot keep the event loop alive or leak between tests.
 *
 * Lazy expiry alone is not enough to bound this, though: an entry that is
 * written and never read again is never looked at, so it would sit in the Map
 * for the life of the process. Since cache keys are routinely derived from
 * user input, that is a leak anyone can drive. The Map is therefore capped,
 * and its insertion order is maintained as an LRU queue - reads move a key to
 * the back, so eviction takes the least recently used.
 */
@Injectable()
export class MemoryService implements CachingInterface {
  private readonly entries = new Map<string, Entry>();
  private readonly defaultTtl: number;
  private readonly maxEntries: number;

  constructor(config: ConfigService) {
    this.defaultTtl = config.get<number>(
      'caching.ttl',
      CACHING_DEFAULTS.ttlSeconds,
    );
    const configured = config.get<number>(
      'caching.maxEntries',
      CACHING_DEFAULTS.maxEntries,
    );
    // A cap below 1 would make the eviction loop empty the Map and keep going,
    // spinning against a key of undefined - an infinite loop holding the event
    // loop. A cache that holds nothing is not a useful reading of the setting
    // anyway, so the floor is one entry.
    this.maxEntries = Number.isFinite(configured)
      ? Math.max(1, Math.floor(configured))
      : CACHING_DEFAULTS.maxEntries;
  }

  /** Live entry count, after eviction. Exposed for tests. */
  get size(): number {
    return this.entries.size;
  }

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.read(key);
    return entry ? (JSON.parse(entry.value) as T) : undefined;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    // Delete before set: re-inserting an existing key would otherwise keep its
    // original position, and a hot key would age out as if it were cold.
    this.entries.delete(key);
    this.entries.set(key, {
      value: JSON.stringify(value),
      expiresAt: Date.now() + (ttlSeconds ?? this.defaultTtl) * 1000,
    });

    while (this.entries.size > this.maxEntries) {
      // Map iterates in insertion order, so the first key is the coldest.
      const coldest = this.entries.keys().next().value;
      this.entries.delete(coldest);
    }
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }

  async has(key: string): Promise<boolean> {
    return this.read(key) !== undefined;
  }

  async clear(): Promise<void> {
    this.entries.clear();
  }

  private read(key: string): Entry | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }

    // Touch: move the key to the back of the queue so eviction reaches it last.
    this.entries.delete(key);
    this.entries.set(key, entry);

    return entry;
  }
}
