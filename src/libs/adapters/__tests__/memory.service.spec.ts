import { ConfigService } from '@nestjs/config';
import { MemoryService } from '../memory.service';

function makeConfig(ttl = 60) {
  return new ConfigService({ caching: { ttl } });
}

function makeCappedConfig(maxEntries: number, ttl = 60) {
  return new ConfigService({ caching: { ttl, maxEntries } });
}

describe('MemoryService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('round-trips a value through set and get', async () => {
    const cache = new MemoryService(makeConfig());

    await cache.set('nonce:0xabc', 'deadbeef');

    await expect(cache.get<string>('nonce:0xabc')).resolves.toBe('deadbeef');
  });

  it('resolves to undefined on a miss', async () => {
    const cache = new MemoryService(makeConfig());

    await expect(cache.get('never-written')).resolves.toBeUndefined();
  });

  it('preserves objects rather than stringifying them', async () => {
    const cache = new MemoryService(makeConfig());

    await cache.set('user:1', { id: 1, roles: ['admin'] });

    await expect(cache.get('user:1')).resolves.toEqual({
      id: 1,
      roles: ['admin'],
    });
  });

  it('hands back a copy, so a caller cannot mutate the cached value in place', async () => {
    const cache = new MemoryService(makeConfig());
    await cache.set('user:1', { roles: ['admin'] });

    const first = await cache.get<{ roles: string[] }>('user:1');
    first.roles.push('superuser');

    await expect(cache.get('user:1')).resolves.toEqual({ roles: ['admin'] });
  });

  it('keeps a stored null distinguishable from a miss', async () => {
    const cache = new MemoryService(makeConfig());

    await cache.set('user:404', null);

    await expect(cache.get('user:404')).resolves.toBeNull();
    await expect(cache.has('user:404')).resolves.toBe(true);
  });

  it('expires an entry once its ttl has elapsed', async () => {
    vi.useFakeTimers();
    const cache = new MemoryService(makeConfig());
    await cache.set('nonce:0xabc', 'deadbeef', 300);

    vi.advanceTimersByTime(299_000);
    await expect(cache.get('nonce:0xabc')).resolves.toBe('deadbeef');

    vi.advanceTimersByTime(2_000);
    await expect(cache.get('nonce:0xabc')).resolves.toBeUndefined();
  });

  it('falls back to the configured default ttl when none is given', async () => {
    vi.useFakeTimers();
    const cache = new MemoryService(makeConfig(60));
    await cache.set('k', 'v');

    vi.advanceTimersByTime(61_000);

    await expect(cache.get('k')).resolves.toBeUndefined();
  });

  it('reports an expired entry as absent', async () => {
    vi.useFakeTimers();
    const cache = new MemoryService(makeConfig());
    await cache.set('k', 'v', 10);

    vi.advanceTimersByTime(11_000);

    await expect(cache.has('k')).resolves.toBe(false);
  });

  it('removes a key on delete', async () => {
    const cache = new MemoryService(makeConfig());
    await cache.set('k', 'v');

    await cache.delete('k');

    await expect(cache.has('k')).resolves.toBe(false);
  });

  it('drops every entry on clear', async () => {
    const cache = new MemoryService(makeConfig());
    await cache.set('a', 1);
    await cache.set('b', 2);

    await cache.clear();

    await expect(cache.get('a')).resolves.toBeUndefined();
    await expect(cache.get('b')).resolves.toBeUndefined();
  });

  // Lazy expiry alone leaves a key that is written and never read again
  // sitting in the Map forever, and cache keys are routinely derived from user
  // input - so without a cap this is a leak anyone can drive.
  it('never grows past the configured cap', async () => {
    const cache = new MemoryService(makeCappedConfig(3));

    for (let i = 0; i < 100; i++) {
      await cache.set(`k${i}`, i);
    }

    expect(cache.size).toBe(3);
  });

  it('drops the least recently used entry once the cap is reached', async () => {
    const cache = new MemoryService(makeCappedConfig(2));
    await cache.set('a', 1);
    await cache.set('b', 2);

    await cache.set('c', 3);

    await expect(cache.get('a')).resolves.toBeUndefined();
    await expect(cache.get('b')).resolves.toBe(2);
    await expect(cache.get('c')).resolves.toBe(3);
  });

  it('spares a key that is still being read', async () => {
    const cache = new MemoryService(makeCappedConfig(2));
    await cache.set('a', 1);
    await cache.set('b', 2);

    // Touching 'a' should make 'b' the coldest entry instead.
    await cache.get('a');
    await cache.set('c', 3);

    await expect(cache.get('a')).resolves.toBe(1);
    await expect(cache.get('b')).resolves.toBeUndefined();
  });

  it('does not let rewriting a key age it out as if it were cold', async () => {
    const cache = new MemoryService(makeCappedConfig(2));
    await cache.set('a', 1);
    await cache.set('b', 2);

    await cache.set('a', 'refreshed');
    await cache.set('c', 3);

    await expect(cache.get('a')).resolves.toBe('refreshed');
    await expect(cache.get('b')).resolves.toBeUndefined();
  });

  it('evicts expired entries as they are read instead of holding a timer', async () => {
    vi.useFakeTimers();
    const cache = new MemoryService(makeConfig());
    await cache.set('k', 'v', 1);
    vi.advanceTimersByTime(2_000);

    await cache.get('k');

    expect(cache.size).toBe(0);
  });
});
