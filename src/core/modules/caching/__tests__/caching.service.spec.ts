import { Logger } from '@nestjs/common';
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

async function build(adapter: CachingInterface) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      CachingService,
      { provide: CACHING_ADAPTER, useValue: adapter },
    ],
  }).compile();

  return moduleRef.get(CachingService);
}

describe('CachingService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
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
