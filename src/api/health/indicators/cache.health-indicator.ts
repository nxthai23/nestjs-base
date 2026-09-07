import { Inject, Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { CACHING_ADAPTER } from '@core/modules/caching/caching.constant';
import { CachingError, CachingInterface } from '@libs/ports/caching.interface';

const HEALTH_KEY = '__health__';

/**
 * Round-trips a key through whichever cache driver is configured, so this
 * works for memory, Redis, Valkey and Memcached alike.
 *
 * It deliberately injects the raw adapter rather than `CachingService`: the
 * facade fails open, so routed through it an unreachable cache would report
 * itself healthy. This is the only legitimate consumer of `CACHING_ADAPTER`
 * outside the caching module.
 */
@Injectable()
export class CacheHealthIndicator {
  constructor(
    @Inject(CACHING_ADAPTER) private readonly cache: CachingInterface,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy(key: string) {
    const indicator = this.healthIndicatorService.check(key);
    const driver = this.cache.constructor.name;
    const probe = Date.now().toString();

    try {
      const start = Date.now();
      await this.cache.set(HEALTH_KEY, probe, 10);
      const echoed = await this.cache.get<string>(HEALTH_KEY);
      const latencyMs = Date.now() - start;

      if (echoed !== probe) {
        return indicator.down({
          driver,
          message: 'Cache accepted a write but did not return the value',
        });
      }

      return indicator.up({ driver, latencyMs });
    } catch (err) {
      return indicator.down({ driver, message: rootCause(err) });
    }
  }
}

/**
 * `CachingError` reads "Caching set failed for key ..." — true, but useless to
 * whoever is reading a health check. Report what actually went wrong.
 */
function rootCause(error: unknown): string {
  if (error instanceof CachingError && error.cause instanceof Error) {
    return error.cause.message;
  }
  return (error as Error).message;
}
