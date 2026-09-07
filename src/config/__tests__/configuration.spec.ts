import configuration from '../configuration';
import { CACHING_DEFAULTS } from '@core/modules/caching/caching.constant';
import { STORAGE_DEFAULTS } from '@core/modules/storage/storage.constant';

const VARS = [
  'CACHE_DRIVER',
  'CACHE_TTL',
  'CACHE_KEY_PREFIX',
  'CACHE_MAX_ENTRIES',
  'STORAGE_DRIVER',
];

/**
 * These defaults used to be written out twice - once here, once at each read
 * site - which is a drift waiting to happen. Both sides now reference the same
 * constant, and this is what holds them together.
 */
describe('configuration', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const name of VARS) {
      saved[name] = process.env[name];
      delete process.env[name];
    }
  });

  afterEach(() => {
    for (const name of VARS) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  });

  it('falls back to the caching defaults when nothing is set', () => {
    const { caching } = configuration();

    expect(caching.driver).toBe(CACHING_DEFAULTS.driver);
    expect(caching.ttl).toBe(CACHING_DEFAULTS.ttlSeconds);
    expect(caching.keyPrefix).toBe(CACHING_DEFAULTS.keyPrefix);
    expect(caching.maxEntries).toBe(CACHING_DEFAULTS.maxEntries);
  });

  it('falls back to the storage default driver', () => {
    expect(configuration().storage.driver).toBe(STORAGE_DEFAULTS.driver);
  });

  it('still reads the environment when it is set', () => {
    process.env.CACHE_TTL = '900';
    process.env.CACHE_KEY_PREFIX = 'app:prod';
    process.env.CACHE_DRIVER = 'redis';

    const { caching } = configuration();

    expect(caching.ttl).toBe(900);
    expect(caching.keyPrefix).toBe('app:prod');
    expect(caching.driver).toBe('redis');
  });
});
