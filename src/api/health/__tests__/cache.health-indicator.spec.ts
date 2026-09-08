import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthIndicatorService } from '@nestjs/terminus';
import { CacheHealthIndicator } from '../indicators/cache.health-indicator';
import { CACHING_ADAPTER } from '@core/modules/caching/caching.constant';
import { CachingService } from '@core/modules/caching/caching.service';
import { MemoryService } from '@libs/adapters/memory.service';
import { CachingError, CachingInterface } from '@libs/ports/caching.interface';

async function build(adapter: CachingInterface) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      CacheHealthIndicator,
      HealthIndicatorService,
      { provide: CACHING_ADAPTER, useValue: adapter },
      { provide: ConfigService, useValue: new ConfigService({}) },
    ],
  }).compile();

  return moduleRef.get(CacheHealthIndicator);
}

function brokenAdapter(): CachingInterface {
  const error = new CachingError(
    'set',
    '__health__',
    new Error('ECONNREFUSED'),
  );
  return {
    get: vi.fn().mockRejectedValue(error),
    set: vi.fn().mockRejectedValue(error),
    delete: vi.fn().mockRejectedValue(error),
    has: vi.fn().mockRejectedValue(error),
    clear: vi.fn().mockRejectedValue(error),
  };
}

/** Records every write, so a test can see what was probed. */
function recordingCache() {
  const writes: { key: string; value: unknown }[] = [];
  const store = new Map<string, unknown>();

  const adapter: CachingInterface = {
    get: async <T>(key: string) => store.get(key) as T | undefined,
    set: async (key: string, value: unknown) => {
      writes.push({ key, value });
      store.set(key, value);
    },
    delete: async (key: string) => {
      store.delete(key);
    },
    has: async (key: string) => store.has(key),
    clear: async () => store.clear(),
  };

  return { adapter, writes };
}

describe('CacheHealthIndicator', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports up with the round-trip latency when the cache answers', async () => {
    const indicator = await build(new MemoryService(new ConfigService({})));

    const result = await indicator.isHealthy('cache');

    expect(result.cache.status).toBe('up');
    expect(result.cache.latencyMs).toEqual(expect.any(Number));
  });

  // Every instance used to probe the same `__health__` key, so two replicas
  // sharing a Redis overwrote each other's probe between set and get and the
  // check reported a healthy cache as down.
  it('probes a key of its own rather than one every instance shares', async () => {
    const { adapter, writes } = recordingCache();
    const indicator = await build(adapter);

    await indicator.isHealthy('cache');
    await indicator.isHealthy('cache');

    expect(new Set(writes.map((write) => write.key)).size).toBe(2);
  });

  it('cleans up after itself instead of leaving a key per check behind', async () => {
    const { adapter, writes } = recordingCache();
    const indicator = await build(adapter);

    await indicator.isHealthy('cache');

    await expect(adapter.has(writes[0].key)).resolves.toBe(false);
  });

  it('still reports up when tidying the probe away fails', async () => {
    const { adapter } = recordingCache();
    adapter.delete = vi.fn().mockRejectedValue(new Error('DEL refused'));
    const indicator = await build(adapter);

    const result = await indicator.isHealthy('cache');

    expect(result.cache.status).toBe('up');
  });

  // The probe value was Date.now(), so two probes inside the same millisecond
  // carried identical payloads - which is why a fixed key looked harmless in
  // testing: overwriting a probe with a byte-identical one hides the clash.
  it('writes a distinguishable probe even for two checks in the same millisecond', async () => {
    vi.useFakeTimers();
    const { adapter, writes } = recordingCache();
    const indicator = await build(adapter);

    await indicator.isHealthy('cache');
    await indicator.isHealthy('cache');

    expect(writes).toHaveLength(2);
    expect(writes[0].value).not.toEqual(writes[1].value);
    vi.useRealTimers();
  });

  it('names the driver it actually checked', async () => {
    const indicator = await build(new MemoryService(new ConfigService({})));

    const result = await indicator.isHealthy('cache');

    expect(result.cache.driver).toBe('MemoryService');
  });

  it('reports down with the underlying message when the cache is unreachable', async () => {
    const indicator = await build(brokenAdapter());

    const result = await indicator.isHealthy('cache');

    expect(result.cache.status).toBe('down');
    expect(result.cache.message).toContain('ECONNREFUSED');
  });

  it('reports down when a write succeeds but the value does not come back', async () => {
    const amnesiac: CachingInterface = {
      get: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      has: vi.fn().mockResolvedValue(false),
      clear: vi.fn().mockResolvedValue(undefined),
    };
    const indicator = await build(amnesiac);

    const result = await indicator.isHealthy('cache');

    expect(result.cache.status).toBe('down');
  });

  // Routed through CachingService, a dead cache would fail open and the check
  // would cheerfully report a down server as up.
  it('checks the raw adapter, not the degrading facade', async () => {
    // The facade logs the outage it swallows; keep it out of the test output.
    vi.spyOn(Logger.prototype, 'error').mockReturnValue(undefined);
    const adapter = brokenAdapter();
    const moduleRef = await Test.createTestingModule({
      providers: [
        CacheHealthIndicator,
        HealthIndicatorService,
        CachingService,
        { provide: CACHING_ADAPTER, useValue: adapter },
        { provide: ConfigService, useValue: new ConfigService({}) },
      ],
    }).compile();
    // The facade swallows the outage...
    await expect(
      moduleRef.get(CachingService).get('__health__'),
    ).resolves.toBeUndefined();

    // ...the indicator must not.
    const result = await moduleRef.get(CacheHealthIndicator).isHealthy('cache');

    expect(result.cache.status).toBe('down');
  });
});
