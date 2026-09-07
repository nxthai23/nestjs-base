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
