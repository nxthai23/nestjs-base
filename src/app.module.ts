import {
  Logger,
  MiddlewareConsumer,
  Module,
  NestModule,
  ValidationPipe,
} from '@nestjs/common';
import { UserModule } from './api/user/user.module';
import { AuthModule } from './api/auth/auth.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import configuration from './config/configuration';
import { APP_PIPE } from '@nestjs/core';
import { LoggerMiddleware } from './core/middlewares/logger.middleware';
import { DatabaseConfig } from './core/database/database';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';
// import { RedisModule } from '@nestjs-modules/ioredis';
import { AppConfigModule } from './api/app-config/app-config.module';
import { SeederModule } from '@core/database/seeder/seeder.module';

@Module({
  imports: [
    UserModule,
    AuthModule,
    ConfigModule.forRoot({
      isGlobal: true,
      cache: false,
      load: [configuration],
    }),
    MikroOrmModule.forRootAsync({
      useClass: DatabaseConfig,
    }),
    SeederModule,
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      isGlobal: true,
      useFactory: async (configService: ConfigService) => {
        const logger = new Logger('CacheModule');
        const redisUrl = configService.get<string>('redis.url');
        if (!redisUrl) {
          logger.log(
            'Redis URL is not configured. Using memory cache instead.',
          );
          return {};
        } else {
          logger.log('Redis URL is configured. Using Redis.');
          return {
            store: await redisStore({
              url: configService.getOrThrow<string>('redis.url'),
              ttl: configService.get('redis.ttl', 60 * 1000), // Default 1 minute in ms
              password: configService.get('redis.password', undefined),
              // @TODO: add retry strategy later
              retryStrategy: () => {
                return;
              },
            }),
          };
        }
      },
    }),
    AppConfigModule,
    // import redis module here for some case that cache module don't work
    // RedisModule.forRootAsync({
    //   imports: [ConfigModule],
    //   useFactory: () => ({
    //     type: 'single',
    //     url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    //   }),
    // }),
  ],
  providers: [
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
