import { ConfigService } from '@nestjs/config';
import { Client } from 'memjs';
import { MemcachedService } from '../memcached.service';
import { CachingError } from '@libs/ports/caching.interface';

function makeConfig(overrides: Record<string, unknown> = {}) {
  return new ConfigService({
    caching: {
      ttl: 60,
      memcached: { servers: 'cache-1:11211,cache-2:11211', ...overrides },
    },
  });
}

function hit(value: unknown) {
  return { value: Buffer.from(JSON.stringify(value)), flags: null };
}

const MISS = { value: null, flags: null };

describe('MemcachedService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('stores the value as JSON with an expiry in seconds', async () => {
    const set = vi.spyOn(Client.prototype, 'set').mockResolvedValue(true);
    const cache = new MemcachedService(makeConfig());

    await cache.set('user:1', { id: 1 }, 300);

    expect(set).toHaveBeenCalledWith('user:1', '{"id":1}', { expires: 300 });
  });

  it('falls back to the configured default ttl when none is given', async () => {
    const set = vi.spyOn(Client.prototype, 'set').mockResolvedValue(true);
    const cache = new MemcachedService(makeConfig());

    await cache.set('k', 'v');

    expect(set).toHaveBeenCalledWith('k', '"v"', { expires: 60 });
  });

  it('parses the stored JSON back into the original value', async () => {
    vi.spyOn(Client.prototype, 'get').mockResolvedValue(hit({ id: 1 }));
    const cache = new MemcachedService(makeConfig());

    await expect(cache.get('user:1')).resolves.toEqual({ id: 1 });
  });

  it('turns a missing key into undefined', async () => {
    vi.spyOn(Client.prototype, 'get').mockResolvedValue(MISS);
    const cache = new MemcachedService(makeConfig());

    await expect(cache.get('missing')).resolves.toBeUndefined();
  });

  it('answers has through a get, since memcached has no EXISTS', async () => {
    const get = vi.spyOn(Client.prototype, 'get').mockResolvedValue(hit('v'));
    const cache = new MemcachedService(makeConfig());

    await expect(cache.has('k')).resolves.toBe(true);
    expect(get).toHaveBeenCalledWith('k');

    get.mockResolvedValue(MISS);
    await expect(cache.has('k')).resolves.toBe(false);
  });

  it('deletes through the client', async () => {
    const del = vi.spyOn(Client.prototype, 'delete').mockResolvedValue(true);
    const cache = new MemcachedService(makeConfig());

    await cache.delete('k');

    expect(del).toHaveBeenCalledWith('k');
  });

  it('clears by flushing every connected server', async () => {
    const flush = vi.spyOn(Client.prototype, 'flush').mockResolvedValue({});
    const cache = new MemcachedService(makeConfig());

    await cache.clear();

    expect(flush).toHaveBeenCalled();
  });

  // Memcached reads any expiry above 30 days as an absolute Unix timestamp,
  // so a naive 60-day ttl would land in January 1970 and expire immediately.
  it('rejects a ttl above 30 days instead of letting it become a 1970 timestamp', async () => {
    const set = vi.spyOn(Client.prototype, 'set').mockResolvedValue(true);
    const cache = new MemcachedService(makeConfig());

    const failure = await cache
      .set('k', 'v', 60 * 60 * 24 * 31)
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(CachingError);
    expect((failure as CachingError).cause).toMatchObject({
      message: expect.stringContaining('30 days'),
    });
    expect(set).not.toHaveBeenCalled();
  });

  it('accepts a ttl of exactly 30 days', async () => {
    const set = vi.spyOn(Client.prototype, 'set').mockResolvedValue(true);
    const cache = new MemcachedService(makeConfig());

    await cache.set('k', 'v', 60 * 60 * 24 * 30);

    expect(set).toHaveBeenCalled();
  });

  it('rejects a key longer than the 250-byte protocol limit', async () => {
    const set = vi.spyOn(Client.prototype, 'set').mockResolvedValue(true);
    const cache = new MemcachedService(makeConfig());

    const failure = await cache
      .set('k'.repeat(251), 'v')
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(CachingError);
    expect((failure as CachingError).cause).toMatchObject({
      message: expect.stringContaining('250'),
    });
    expect(set).not.toHaveBeenCalled();
  });

  it('measures the key limit in bytes, not characters', async () => {
    vi.spyOn(Client.prototype, 'set').mockResolvedValue(true);
    const cache = new MemcachedService(makeConfig());

    // 100 characters, but 4 bytes each in UTF-8.
    const failure = await cache
      .set('𝔞'.repeat(100), 'v')
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(CachingError);
  });

  it('wraps client failures in CachingError so memjs errors stay contained', async () => {
    const clientError = new Error('server unavailable');
    vi.spyOn(Client.prototype, 'get').mockRejectedValue(clientError);
    const cache = new MemcachedService(makeConfig());

    const failure = await cache.get('k').catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(CachingError);
    expect(failure).toMatchObject({
      operation: 'get',
      key: 'k',
      cause: clientError,
    });
  });

  it('closes the connection on application shutdown', async () => {
    const quit = vi.spyOn(Client.prototype, 'quit').mockReturnValue(undefined);
    const cache = new MemcachedService(makeConfig());

    await cache.beforeApplicationShutdown();

    expect(quit).toHaveBeenCalled();
  });
});
