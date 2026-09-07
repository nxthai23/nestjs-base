import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisOptions, RedisService } from './redis.service';

/**
 * Valkey is a fork of Redis 7.2 and speaks the same wire protocol, so it
 * reuses the Redis implementation and only points it at a different url.
 *
 * The separate driver exists so the registry states the supported providers
 * honestly, and so there is somewhere to put the divergence that started in
 * Valkey 8.
 */
@Injectable()
export class ValkeyService extends RedisService {
  protected readOptions(config: ConfigService): RedisOptions {
    return {
      url: toRedisScheme(config.getOrThrow<string>('caching.valkey.url')),
      ttl: config.get<number>('caching.ttl', 60),
    };
  }
}

/**
 * ioredis recognises only `redis://` and `rediss://`. Given any other scheme it
 * falls back to parsing the string as `host:port`, so `valkey://cache:6379`
 * would quietly connect to a host named "valkey" and `valkeys://` would drop
 * TLS — both without raising anything. Normalise before the client sees it.
 */
function toRedisScheme(url: string): string {
  return url
    .replace(/^valkeys:\/\//i, 'rediss://')
    .replace(/^valkey:\/\//i, 'redis://');
}
