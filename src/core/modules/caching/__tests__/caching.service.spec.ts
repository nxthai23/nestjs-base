import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { CachingService } from '../caching.service';
import { CACHING_ADAPTER } from '../caching.constant';
import { CachingError, CachingInterface } from '@libs/ports/caching.interface';

function makeFakeAdapter(): CachingInterface {
  return {
    get: vi.fn().mockResolvedValue('cached'),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    has: vi.fn().mockResolvedValue(true),
    clear: vi.fn().mockResolvedValue(undefined),
  };
}

/** Every method rejects, standing in for a cache server that is down. */
function makeBrokenAdapter(error: unknown): CachingInterface {
  return {
    get: vi.fn().mockRejectedValue(error),
    set: vi.fn().mockRejectedValue(error),
    delete: vi.fn().mockRejectedValue(error),
    has: vi.fn().mockRejectedValue(error),
    clear: vi.fn().mockRejectedValue(error),
  };
}

async function build(adapter: CachingInterface, keyPrefix = '') {
  const moduleRef = await Test.createTestingModule({
    providers: [
      CachingService,
      { provide: CACHING_ADAPTER, useValue: adapter },
      {
        provide: ConfigService,
        useValue: new ConfigService({ caching: { keyPrefix } }),
      },
    ],
  }).compile();

  return moduleRef.get(CachingService);
}

describe('CachingService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // `undefined` cannot round-trip: JSON.stringify hands back the value
  // undefined rather than a string, and `get` already spends undefined on
  // "miss", so a cached undefined would be unreadable even if it stored.
  // The cache is one shared map. Two features picking the same identifier -
  // a wallet address, a user id - would otherwise overwrite each other with
  // nothing to warn them.
  describe('keyspace', () => {
    it('passes keys through untouched when no prefix is configured', async () => {
      const adapter = makeFakeAdapter();
      const caching = await build(adapter);

      await caching.get('k');

      expect(adapter.get).toHaveBeenCalledWith('k');
    });

    it('prepends the configured prefix to every operation', async () => {
      const adapter = makeFakeAdapter();
      const caching = await build(adapter, 'nestjs-base:prod');

      await caching.get('k');
      await caching.set('k', 1);
      await caching.delete('k');
      await caching.has('k');

      expect(adapter.get).toHaveBeenCalledWith('nestjs-base:prod:k');
      expect(adapter.set).toHaveBeenCalledWith(
        'nestjs-base:prod:k',
        1,
        undefined,
      );
      expect(adapter.delete).toHaveBeenCalledWith('nestjs-base:prod:k');
      expect(adapter.has).toHaveBeenCalledWith('nestjs-base:prod:k');
    });

    it('does not double the separator when the prefix already ends in one', async () => {
      const adapter = makeFakeAdapter();
      const caching = await build(adapter, 'app:');

      await caching.get('k');

      expect(adapter.get).toHaveBeenCalledWith('app:k');
    });

    it('confines a namespace to its own part of the keyspace', async () => {
      const adapter = makeFakeAdapter();
      const caching = await build(adapter);
      const nonces = caching.namespace('siwe:nonce');

      await nonces.set('0xabc', 'deadbeef');

      expect(adapter.set).toHaveBeenCalledWith(
        'siwe:nonce:0xabc',
        'deadbeef',
        undefined,
      );
    });

    it('keeps two namespaces off each other keys', async () => {
      const adapter = makeFakeAdapter();
      const caching = await build(adapter);

      await caching.namespace('siwe:nonce').set('0xabc', 'nonce');
      await caching.namespace('profile').set('0xabc', 'profile');

      expect(adapter.set).toHaveBeenNthCalledWith(
        1,
        'siwe:nonce:0xabc',
        'nonce',
        undefined,
      );
      expect(adapter.set).toHaveBeenNthCalledWith(
        2,
        'profile:0xabc',
        'profile',
        undefined,
      );
    });

    it('applies the deployment prefix underneath the namespace', async () => {
      const adapter = makeFakeAdapter();
      const caching = await build(adapter, 'app');

      await caching.namespace('siwe:nonce').get('0xabc');

      expect(adapter.get).toHaveBeenCalledWith('app:siwe:nonce:0xabc');
    });

    // set(key, undefined) routes through delete, which qualifies the key
    // itself - qualifying first would prefix it twice.
    it('deletes the right key when a namespaced value is set to undefined', async () => {
      const adapter = makeFakeAdapter();
      const caching = await build(adapter, 'app');

      await caching.namespace('siwe:nonce').set('0xabc', undefined);

      expect(adapter.delete).toHaveBeenCalledWith('app:siwe:nonce:0xabc');
      expect(adapter.set).not.toHaveBeenCalled();
    });

    // Clearing one namespace means enumerating its keys, and memcached has no
    // SCAN. Offering it would be a promise only some drivers keep.
    it('offers no clear on a namespace', async () => {
      const caching = await build(makeFakeAdapter());

      expect('clear' in caching.namespace('siwe:nonce')).toBe(false);
    });
  });

  describe('undefined values', () => {
    it('removes the key instead of storing an unreadable value', async () => {
      const adapter = makeFakeAdapter();
      const caching = await build(adapter);

      await caching.set('k', undefined);

      expect(adapter.set).not.toHaveBeenCalled();
      expect(adapter.delete).toHaveBeenCalledWith('k');
    });

    it('still stores null, which round-trips fine', async () => {
      const adapter = makeFakeAdapter();
      const caching = await build(adapter);

      await caching.set('k', null);

      expect(adapter.set).toHaveBeenCalledWith('k', null, undefined);
      expect(adapter.delete).not.toHaveBeenCalled();
    });
  });

  describe('delegation', () => {
    it('passes reads to whichever adapter is wired in', async () => {
      const adapter = makeFakeAdapter();
      const caching = await build(adapter);

      await expect(caching.get<string>('k')).resolves.toBe('cached');
      expect(adapter.get).toHaveBeenCalledWith('k');
    });

    it('passes writes to the adapter, forwarding the ttl', async () => {
      const adapter = makeFakeAdapter();
      const caching = await build(adapter);

      await caching.set('k', { id: 1 }, 300);

      expect(adapter.set).toHaveBeenCalledWith('k', { id: 1 }, 300);
    });

    it('passes deletes to the adapter', async () => {
      const adapter = makeFakeAdapter();
      const caching = await build(adapter);

      await caching.delete('k');

      expect(adapter.delete).toHaveBeenCalledWith('k');
    });

    it('passes existence checks to the adapter', async () => {
      const adapter = makeFakeAdapter();
      const caching = await build(adapter);

      await expect(caching.has('k')).resolves.toBe(true);
      expect(adapter.has).toHaveBeenCalledWith('k');
    });

    it('passes clear to the adapter', async () => {
      const adapter = makeFakeAdapter();
      const caching = await build(adapter);

      await caching.clear();

      expect(adapter.clear).toHaveBeenCalled();
    });
  });

  // A cache is an optimisation. If it is down, requests get slower — they do
  // not fail. The adapter still throws; degrading is this facade's job.
  describe('failing open', () => {
    const outage = new CachingError('get', 'k', new Error('ECONNREFUSED'));
    let log: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      // These cases deliberately drive failures; keep the noise out of the
      // test output while still asserting the call.
      log = vi
        .spyOn(Logger.prototype, 'error')
        .mockReturnValue(undefined) as never;
    });

    it('turns a failed read into a miss', async () => {
      const caching = await build(makeBrokenAdapter(outage));

      await expect(caching.get('k')).resolves.toBeUndefined();
    });

    it('reports a failed existence check as absent', async () => {
      const caching = await build(makeBrokenAdapter(outage));

      await expect(caching.has('k')).resolves.toBe(false);
    });

    it('swallows a failed write', async () => {
      const caching = await build(makeBrokenAdapter(outage));

      await expect(caching.set('k', 'v')).resolves.toBeUndefined();
    });

    it('swallows a failed delete', async () => {
      const caching = await build(makeBrokenAdapter(outage));

      await expect(caching.delete('k')).resolves.toBeUndefined();
    });

    it('swallows a failed clear', async () => {
      const caching = await build(makeBrokenAdapter(outage));

      await expect(caching.clear()).resolves.toBeUndefined();
    });

    it('logs every degraded operation, so an outage is invisible in responses but not in logs', async () => {
      const caching = await build(makeBrokenAdapter(outage));

      await caching.get('nonce:0xabc');

      expect(log).toHaveBeenCalledOnce();
      expect(log.mock.calls[0][0]).toContain('nonce:0xabc');
    });

    it('degrades on any adapter failure, not only CachingError', async () => {
      const caching = await build(makeBrokenAdapter(new TypeError('boom')));

      await expect(caching.get('k')).resolves.toBeUndefined();
    });
  });
});
