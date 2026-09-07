import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisService } from '../redis.service';
import { CachingError } from '@libs/ports/caching.interface';

function makeConfig(overrides: Record<string, unknown> = {}) {
  return new ConfigService({
    caching: {
      ttl: 60,
      redis: { url: 'redis://localhost:6379' },
      ...overrides,
    },
  });
}

/** The client is private; reach through the adapter to inspect it. */
function clientOf(adapter: RedisService): Redis {
  return (adapter as unknown as { client: Redis }).client;
}

/** ioredis keeps its connection state in a plain property. */
function setStatus(adapter: RedisService, status: string): void {
  (clientOf(adapter) as unknown as { status: string }).status = status;
}

describe('RedisService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens no socket while constructing, so a boot never waits on Redis', () => {
    const connect = vi.spyOn(Redis.prototype, 'connect');

    new RedisService(makeConfig());

    expect(connect).not.toHaveBeenCalled();
  });

  it('stores the value as JSON with an expiry in seconds', async () => {
    const set = vi.spyOn(Redis.prototype, 'set').mockResolvedValue('OK');
    const cache = new RedisService(makeConfig());

    await cache.set('user:1', { id: 1 }, 300);

    expect(set).toHaveBeenCalledWith('user:1', '{"id":1}', 'EX', 300);
  });

  it('falls back to the configured default ttl when none is given', async () => {
    const set = vi.spyOn(Redis.prototype, 'set').mockResolvedValue('OK');
    const cache = new RedisService(makeConfig());

    await cache.set('k', 'v');

    expect(set).toHaveBeenCalledWith('k', '"v"', 'EX', 60);
  });

  it('parses the stored JSON back into the original value', async () => {
    vi.spyOn(Redis.prototype, 'get').mockResolvedValue('{"id":1}');
    const cache = new RedisService(makeConfig());

    await expect(cache.get('user:1')).resolves.toEqual({ id: 1 });
  });

  it('turns a missing key into undefined rather than null', async () => {
    vi.spyOn(Redis.prototype, 'get').mockResolvedValue(null);
    const cache = new RedisService(makeConfig());

    await expect(cache.get('missing')).resolves.toBeUndefined();
  });

  it('keeps a stored null distinguishable from a miss', async () => {
    vi.spyOn(Redis.prototype, 'get').mockResolvedValue('null');
    const cache = new RedisService(makeConfig());

    await expect(cache.get('user:404')).resolves.toBeNull();
  });

  it('deletes through DEL', async () => {
    const del = vi.spyOn(Redis.prototype, 'del').mockResolvedValue(1);
    const cache = new RedisService(makeConfig());

    await cache.delete('k');

    expect(del).toHaveBeenCalledWith('k');
  });

  it('answers has through EXISTS', async () => {
    const exists = vi.spyOn(Redis.prototype, 'exists').mockResolvedValue(1);
    const cache = new RedisService(makeConfig());

    await expect(cache.has('k')).resolves.toBe(true);
    expect(exists).toHaveBeenCalledWith('k');

    exists.mockResolvedValue(0);
    await expect(cache.has('k')).resolves.toBe(false);
  });

  it('clears through FLUSHDB', async () => {
    const flushdb = vi
      .spyOn(Redis.prototype, 'flushdb')
      .mockResolvedValue('OK');
    const cache = new RedisService(makeConfig());

    await cache.clear();

    expect(flushdb).toHaveBeenCalled();
  });

  it('wraps client failures in CachingError so ioredis errors stay contained', async () => {
    const clientError = Object.assign(new Error('ECONNREFUSED'), {
      code: 'ECONNREFUSED',
    });
    vi.spyOn(Redis.prototype, 'get').mockRejectedValue(clientError);
    const cache = new RedisService(makeConfig());

    const failure = await cache.get('k').catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(CachingError);
    expect(failure).toMatchObject({
      operation: 'get',
      key: 'k',
      cause: clientError,
    });
  });

  it('reports the key as "*" when the failing operation has no single key', async () => {
    vi.spyOn(Redis.prototype, 'flushdb').mockRejectedValue(new Error('nope'));
    const cache = new RedisService(makeConfig());

    const failure = await cache.clear().catch((error: unknown) => error);

    expect(failure).toMatchObject({ operation: 'clear', key: '*' });
  });

  it('fails fast instead of queueing retries behind a dead server', () => {
    const options = clientOf(new RedisService(makeConfig())).options;

    expect(options.maxRetriesPerRequest).toBe(1);
    expect(options.retryStrategy()).toBeNull();
  });

  it('closes a live connection on application shutdown', async () => {
    const quit = vi.spyOn(Redis.prototype, 'quit').mockResolvedValue('OK');
    const cache = new RedisService(makeConfig());
    setStatus(cache, 'ready');

    await cache.beforeApplicationShutdown();

    expect(quit).toHaveBeenCalled();
  });

  // lazyConnect leaves the client in `wait` until the first command. ioredis
  // answers QUIT there by opening the connection first, and with retries
  // disabled that attempt rejects - so an app that never touched the cache
  // used to fail its own shutdown.
  it('sends no QUIT when the client never connected', async () => {
    const connect = vi.spyOn(Redis.prototype, 'connect');
    const quit = vi.spyOn(Redis.prototype, 'quit');
    const disconnect = vi.spyOn(Redis.prototype, 'disconnect');
    const cache = new RedisService(makeConfig());

    expect(clientOf(cache).status).toBe('wait');
    await expect(cache.beforeApplicationShutdown()).resolves.toBeUndefined();

    expect(quit).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();
  });

  it('drops the socket rather than failing shutdown when QUIT rejects', async () => {
    vi.spyOn(Redis.prototype, 'quit').mockRejectedValue(
      new Error('Connection is closed.'),
    );
    const disconnect = vi.spyOn(Redis.prototype, 'disconnect');
    const cache = new RedisService(makeConfig());
    setStatus(cache, 'ready');

    await expect(cache.beforeApplicationShutdown()).resolves.toBeUndefined();

    expect(disconnect).toHaveBeenCalled();
  });
});
