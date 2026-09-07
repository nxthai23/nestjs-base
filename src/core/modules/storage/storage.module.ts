import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StorageInterface } from '@libs/ports/storage.interface';
import { registry, StorageDriver } from '@libs/registry';
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
            const Adapter = registry.storage[driver];
            if (!Adapter) {
              throw new Error(`Unknown STORAGE_DRIVER: ${driver}`);
            }
            return new Adapter(config);
          },
        },
        StorageService,
      ],
      exports: [StorageService],
    };
  }
}
