export const STORAGE_ADAPTER = Symbol('STORAGE_ADAPTER');

/** See CACHING_DEFAULTS: one definition, referenced by config and by module. */
export const STORAGE_DEFAULTS = {
  driver: 's3',
} as const;
