import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CachingInterface } from '@libs/ports/caching.interface';
import { CachingDriver, hasOwn, registry } from '@libs/registry';
import { CACHING_ADAPTER, CACHING_DEFAULTS } from './caching.constant';
import { CachingService } from './caching.service';

@Module({})
export class CachingModule {
  static forRootAsync(): DynamicModule {
    return {
      module: CachingModule,
      global: true,
      imports: [ConfigModule],
      providers: [
        {
          provide: CACHING_ADAPTER,
          inject: [ConfigService],
          useFactory: (config: ConfigService): CachingInterface => {
            // Defaults to memory, so the app boots with no cache
            // configuration at all.
            const driver = config.get<CachingDriver>(
              'caching.driver',
              CACHING_DEFAULTS.driver,
            );
            // An own-property check, not a truthiness one: a plain object
            // answers for everything on Object.prototype, so `constructor`
            // would otherwise pass the guard and hand back the ConfigService
            // as the cache. (Object.hasOwn needs es2022; target here is
            // es2020.)
            if (!hasOwn(registry.caching, driver)) {
              throw new Error(`Unknown CACHE_DRIVER: ${driver}`);
            }
            return new registry.caching[driver](config);
          },
        },
        CachingService,
      ],
      // CACHING_ADAPTER is exported only for the cache health check, which
      // must see a real failure rather than CachingService's fail-open miss.
      exports: [CachingService, CACHING_ADAPTER],
    };
  }
}
