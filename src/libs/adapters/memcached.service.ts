import { BeforeApplicationShutdown, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'memjs';
import { CachingError, CachingInterface } from '@libs/ports/caching.interface';
import { CACHING_DEFAULTS } from '@core/modules/caching/caching.constant';

/** Any expiry above this is read by memcached as an absolute Unix timestamp. */
const MAX_TTL_SECONDS = 60 * 60 * 24 * 30;

/** Memcached protocol limit. */
const MAX_KEY_BYTES = 250;

/**
 * Memcached cache adapter. This is the driver the port is shaped around: it
 * has no sorted sets, no pipelines and no SCAN, so it is the reason those
 * never appear in `CachingInterface`.
 *
 * The two protocol traps below fail loudly here rather than silently
 * misbehaving at runtime.
 */
@Injectable()
export class MemcachedService
  implements CachingInterface, BeforeApplicationShutdown
{
  private readonly client: Client;
  private readonly defaultTtl: number;

  constructor(config: ConfigService) {
    this.defaultTtl = config.get<number>(
      'caching.ttl',
      CACHING_DEFAULTS.ttlSeconds,
    );
    this.client = Client.create(
      config.getOrThrow<string>('caching.memcached.servers'),
      {
        username: config.get<string>('caching.memcached.username'),
        password: config.get<string>('caching.memcached.password'),
      },
    );
  }

  async get<T>(key: string): Promise<T | undefined> {
    return this.execute('get', key, async () => {
      const { value } = await this.client.get(key);
      return value === null ? undefined : (JSON.parse(value.toString()) as T);
    });
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const expires = ttlSeconds ?? this.defaultTtl;

    await this.execute('set', key, async () => {
      assertKeyFits(key);
      assertTtlIsRelative(expires);
      await this.client.set(key, JSON.stringify(value), { expires });
    });
  }

  async delete(key: string): Promise<void> {
    await this.execute('delete', key, () => this.client.delete(key));
  }

  async has(key: string): Promise<boolean> {
    // Memcached has no EXISTS, so this is a get with the value discarded.
    return this.execute(
      'has',
      key,
      async () => (await this.client.get(key)).value !== null,
    );
  }

  async clear(): Promise<void> {
    await this.execute('clear', '*', () => this.client.flush());
  }

  async beforeApplicationShutdown(): Promise<void> {
    this.client.quit();
  }

  private async execute<T>(
    operation: string,
    key: string,
    run: () => Promise<T>,
  ): Promise<T> {
    try {
      return await run();
    } catch (error) {
      throw new CachingError(operation, key, error);
    }
  }
}

function assertTtlIsRelative(ttlSeconds: number): void {
  if (ttlSeconds > MAX_TTL_SECONDS) {
    throw new Error(
      `Memcached reads a ttl over 30 days as an absolute Unix timestamp; ` +
        `${ttlSeconds}s would expire the entry immediately. ` +
        `Use ${MAX_TTL_SECONDS}s or less.`,
    );
  }
}

function assertKeyFits(key: string): void {
  const bytes = Buffer.byteLength(key, 'utf8');
  if (bytes > MAX_KEY_BYTES) {
    throw new Error(
      `Memcached keys are limited to ${MAX_KEY_BYTES} bytes; this one is ${bytes}.`,
    );
  }
}
