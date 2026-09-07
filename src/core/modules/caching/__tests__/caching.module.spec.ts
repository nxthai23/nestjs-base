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
