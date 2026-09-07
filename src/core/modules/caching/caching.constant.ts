export const CACHING_ADAPTER = Symbol('CACHING_ADAPTER');

/**
 * The single definition of what caching does without configuration.
 *
 * `configuration.ts` applies these to the config object, so in a running app
 * every key is present. The fallbacks at each read site exist for the tests
 * and for anyone composing `CachingModule` by hand - which is also why the
 * module boots with no cache configuration at all. Referencing the constant
 * rather than repeating the literal is what keeps those two paths agreeing.
 */
export const CACHING_DEFAULTS = {
  driver: 'memory',
  /** Entry lifetime, in seconds. */
  ttlSeconds: 60,
  /** Memory driver only: entries held before the coldest is evicted. */
  maxEntries: 10000,
  /** No deployment prefix unless one is configured. */
  keyPrefix: '',
} as const;
