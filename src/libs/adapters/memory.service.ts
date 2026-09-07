import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CachingInterface } from '@libs/ports/caching.interface';

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
 */
@Injectable()
export class MemoryService implements CachingInterface {
  private readonly entries = new Map<string, Entry>();
  private readonly defaultTtl: number;

  constructor(config: ConfigService) {
    this.defaultTtl = config.get<number>('caching.ttl', 60);
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
    this.entries.set(key, {
      value: JSON.stringify(value),
      expiresAt: Date.now() + (ttlSeconds ?? this.defaultTtl) * 1000,
    });
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

    return entry;
  }
}
