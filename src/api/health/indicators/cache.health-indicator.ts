import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { CACHING_ADAPTER } from '@core/modules/caching/caching.constant';
import { CachingError, CachingInterface } from '@libs/ports/caching.interface';

const HEALTH_KEY_PREFIX = '__health__';

/**
 * Short: the probe is deleted as soon as it is read, so the ttl only has to
 * cover a check that dies between the write and the delete.
 */
const PROBE_TTL_SECONDS = 10;

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

    // Unique per check, not a fixed key with a timestamp. Replicas share one
    // cache server, so a fixed key means two of them overwrite each other's
    // probe between set and get and both report a healthy cache as down. A
    // timestamp is not enough either: two checks inside the same millisecond
    // write identical payloads, which hides the clash rather than avoiding it.
    const probe = randomUUID();
    const probeKey = `${HEALTH_KEY_PREFIX}:${probe}`;

    try {
      const start = Date.now();
      await this.cache.set(probeKey, probe, PROBE_TTL_SECONDS);
      const echoed = await this.cache.get<string>(probeKey);
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
    } finally {
      // One key per check would otherwise pile up until each expires. Failing
      // to tidy up is not itself a health problem, so it never changes the
      // verdict - the check above has already decided.
      await this.cache.delete(probeKey).catch(() => undefined);
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
