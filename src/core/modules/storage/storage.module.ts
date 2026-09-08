import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StorageInterface } from '@libs/ports/storage.interface';
import { hasOwn, registry, StorageDriver } from '@libs/registry';
import { STORAGE_ADAPTER, STORAGE_DEFAULTS } from './storage.constant';
import { StorageService } from './storage.service';

@Module({})
export class StorageModule {
  static forRootAsync(): DynamicModule {
    return {
      module: StorageModule,
      global: true,
      imports: [ConfigModule],
      providers: [
        {
          provide: STORAGE_ADAPTER,
          inject: [ConfigService],
          useFactory: (config: ConfigService): StorageInterface => {
            // Not getOrThrow: configuration.ts always supplies a driver,
            // so it could never have thrown - it only read as though it might.
            const driver = config.get<StorageDriver>(
              'storage.driver',
              STORAGE_DEFAULTS.driver,
            );
            // An own-property check - see the same guard in caching.module.ts
            // for what a plain lookup lets through.
            if (!hasOwn(registry.storage, driver)) {
              throw new Error(`Unknown STORAGE_DRIVER: ${driver}`);
            }
            return new registry.storage[driver](config);
          },
        },
        StorageService,
      ],
      exports: [StorageService],
    };
  }
}
