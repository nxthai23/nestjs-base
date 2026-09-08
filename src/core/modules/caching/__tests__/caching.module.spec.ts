import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { CachingModule } from '../caching.module';
import { CachingService } from '../caching.service';
import { CACHING_ADAPTER } from '../caching.constant';
import { MemoryService } from '@libs/adapters/memory.service';
import { RedisService } from '@libs/adapters/redis.service';
import { ValkeyService } from '@libs/adapters/valkey.service';
import { MemcachedService } from '@libs/adapters/memcached.service';

const cachingConfig = {
  ttl: 60,
  redis: { url: 'redis://localhost:6379' },
  valkey: { url: 'valkey://localhost:6379' },
  memcached: { servers: 'localhost:11211' },
};

function compileWithDriver(driver: string) {
  return Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        load: [() => ({ caching: { driver, ...cachingConfig } })],
      }),
      CachingModule.forRootAsync(),
    ],
  }).compile();
}

describe('CachingModule', () => {
  it.each([
    ['memory', MemoryService],
    ['redis', RedisService],
    ['valkey', ValkeyService],
    ['memcached', MemcachedService],
  ])(
    'wires the %s adapter — no calling code changes',
    async (driver, Adapter) => {
      const moduleRef = await compileWithDriver(driver);

      expect(moduleRef.get(CACHING_ADAPTER)).toBeInstanceOf(Adapter);
    },
  );

  it('fails at boot when the driver is not in the registry', async () => {
    await expect(compileWithDriver('dynamodb')).rejects.toThrow(
      /Unknown CACHE_DRIVER: dynamodb/,
    );
  });

  // A plain object lookup also answers for everything on Object.prototype, so
  // `constructor` used to pass the guard: `new Object(config)` returns the
  // ConfigService itself, and the app booted with its own configuration
  // standing in for the cache - every get quietly answering with a config
  // value instead of a cached one.
  it.each(['constructor', 'toString', 'valueOf', 'hasOwnProperty'])(
    'rejects %s rather than resolving it off Object.prototype',
    async (driver) => {
      await expect(compileWithDriver(driver)).rejects.toThrow(
        new RegExp(`Unknown CACHE_DRIVER: ${driver}`),
      );
    },
  );

  it('exports the facade for feature code', async () => {
    const moduleRef = await compileWithDriver('memory');

    expect(moduleRef.get(CachingService)).toBeInstanceOf(CachingService);
  });

  // The health indicator needs the undegraded adapter: routed through the
  // facade, a dead cache would fail open and report itself healthy.
  it('exports the raw adapter token so the health check can bypass fail-open', async () => {
    const moduleRef = await compileWithDriver('memory');

    expect(moduleRef.get(CACHING_ADAPTER)).toBeDefined();
  });

  // The adapter is built by a useFactory, not resolved as a class provider,
  // so it is worth pinning down that Nest still runs its lifecycle hooks -
  // that is the only thing closing the cache connection on a rolling restart.
  it('runs the adapter shutdown hook when the app closes', async () => {
    const moduleRef = await compileWithDriver('redis');
    const app = moduleRef.createNestApplication();
    await app.init();

    const adapter = app.get<RedisService>(CACHING_ADAPTER);
    const hook = vi.spyOn(adapter, 'beforeApplicationShutdown');

    await app.close();

    expect(hook).toHaveBeenCalled();
  });

  it('boots with no configuration at all, since memory is the default driver', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [() => ({})] }),
        CachingModule.forRootAsync(),
      ],
    }).compile();

    expect(moduleRef.get(CACHING_ADAPTER)).toBeInstanceOf(MemoryService);
  });
});
