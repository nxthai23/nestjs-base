import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { ValkeyService } from '../valkey.service';
import { RedisService } from '../redis.service';

function makeConfig() {
  return new ConfigService({
    caching: {
      ttl: 120,
      redis: { url: 'redis://should-not-be-read:6379' },
      valkey: { url: 'valkey://valkey-primary:6379' },
    },
  });
}

function clientOf(adapter: ValkeyService): Redis {
  return (adapter as unknown as { client: Redis }).client;
}

describe('ValkeyService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('connects to the Valkey url, not the Redis one', () => {
    const options = clientOf(new ValkeyService(makeConfig())).options;

    expect(options.host).toBe('valkey-primary');
    expect(options.port).toBe(6379);
  });

  // ioredis only recognises redis:// and rediss://. Handed anything else it
  // parses the string as "host:port", so "valkey://valkey-primary:6379" would
  // silently dial a host literally named "valkey" — and "valkeys://" would
  // drop TLS without complaining. The adapter absorbs that.
  it('rewrites the valkey:// scheme so ioredis does not mis-parse it as a hostname', () => {
    const config = new ConfigService({
      caching: { ttl: 60, valkey: { url: 'valkey://valkey-primary:6379' } },
    });

    const options = clientOf(new ValkeyService(config)).options;

    expect(options.host).toBe('valkey-primary');
    expect(options.port).toBe(6379);
  });

  it('keeps TLS on when the valkeys:// scheme is used', () => {
    const config = new ConfigService({
      caching: { ttl: 60, valkey: { url: 'valkeys://valkey-primary:6380' } },
    });

    const options = clientOf(new ValkeyService(config)).options;

    expect(options.host).toBe('valkey-primary');
    expect(options.port).toBe(6380);
    expect(options.tls).toBeTruthy();
  });

  it('leaves a redis:// url untouched, since Valkey accepts it', () => {
    const config = new ConfigService({
      caching: { ttl: 60, valkey: { url: 'redis://valkey-primary:6379' } },
    });

    const options = clientOf(new ValkeyService(config)).options;

    expect(options.host).toBe('valkey-primary');
  });

  it('inherits the Redis implementation rather than duplicating it', async () => {
    const set = vi.spyOn(Redis.prototype, 'set').mockResolvedValue('OK');
    const cache = new ValkeyService(makeConfig());

    expect(cache).toBeInstanceOf(RedisService);

    await cache.set('user:1', { id: 1 });

    expect(set).toHaveBeenCalledWith('user:1', '{"id":1}', 'EX', 120);
  });
});
