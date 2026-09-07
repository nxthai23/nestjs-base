import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CachingInterface } from '@libs/ports/caching.interface';
import { CachingDriver, registry } from '@libs/registry';
import { CACHING_ADAPTER } from './caching.constant';
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
              'memory',
            );
            const Adapter = registry.caching[driver];
            if (!Adapter) {
              throw new Error(`Unknown CACHE_DRIVER: ${driver}`);
            }
            return new Adapter(config);
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
