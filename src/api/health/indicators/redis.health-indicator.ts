import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthIndicatorService } from '@nestjs/terminus';
import Redis from 'ioredis';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly configService: ConfigService,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy(key: string) {
    const indicator = this.healthIndicatorService.check(key);
    const url = this.configService.get<string>('redis.url');

    if (!url) {
      return indicator.up({
        message: 'Redis is not configured, using in-memory cache',
      });
    }

    const client = new Redis(url, {
      lazyConnect: true,
      connectTimeout: 2000,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });

    try {
      const start = Date.now();
      await client.connect();
      await client.ping();
      return indicator.up({ latencyMs: Date.now() - start });
    } catch (err) {
      return indicator.down({ message: (err as Error).message });
    } finally {
      client.disconnect();
    }
  }
}
