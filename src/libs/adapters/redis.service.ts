import { BeforeApplicationShutdown, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CachingError, CachingInterface } from '@libs/ports/caching.interface';

export interface RedisOptions {
  url: string;
  ttl: number;
}

/**
 * Redis cache adapter. `ValkeyService` extends this and overrides only
 * `readOptions`, the same seam `S3Service` exposes for `R2Service`.
 */
@Injectable()
export class RedisService
  implements CachingInterface, BeforeApplicationShutdown
{
  protected readonly client: Redis;
  protected readonly defaultTtl: number;

  constructor(config: ConfigService) {
    const options = this.readOptions(config);
    this.defaultTtl = options.ttl;
    this.client = new Redis(options.url, {
      // Nothing connects until the first command, so booting the app never
      // waits on Redis and constructing the adapter in a test opens no socket.
      lazyConnect: true,
      // A cache must fail fast rather than hold a request open behind a dead
      // server; CachingService turns the resulting error into a miss.
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
  }

  protected readOptions(config: ConfigService): RedisOptions {
    return {
      url: config.getOrThrow<string>('caching.redis.url'),
      ttl: config.get<number>('caching.ttl', 60),
    };
  }

  async get<T>(key: string): Promise<T | undefined> {
    return this.execute('get', key, async () => {
      const raw = await this.client.get(key);
      return raw === null ? undefined : (JSON.parse(raw) as T);
    });
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.execute('set', key, () =>
      this.client.set(
        key,
        JSON.stringify(value),
        'EX',
        ttlSeconds ?? this.defaultTtl,
      ),
    );
  }

  async delete(key: string): Promise<void> {
    await this.execute('delete', key, () => this.client.del(key));
  }

  async has(key: string): Promise<boolean> {
    return this.execute(
      'has',
      key,
      async () => (await this.client.exists(key)) > 0,
    );
  }

  async clear(): Promise<void> {
    await this.execute('clear', '*', () => this.client.flushdb());
  }

  async beforeApplicationShutdown(): Promise<void> {
    // With lazyConnect the client can still be in `wait`: no socket has ever
    // been opened. ioredis answers QUIT by connecting first, just to say
    // goodbye - and with retries disabled that connect attempt rejects, so an
    // app that never touched the cache would fail its own shutdown.
    if (this.client.status === 'wait' || this.client.status === 'end') {
      this.client.disconnect();
      return;
    }

    try {
      await this.client.quit();
    } catch {
      // A cache disappearing mid-shutdown is not worth failing shutdown over.
      this.client.disconnect();
    }
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
