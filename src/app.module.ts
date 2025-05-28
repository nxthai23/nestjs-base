import {
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

@Module({
  imports: [
    UserModule,
    AuthModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    MikroOrmModule.forRootAsync({
      useClass: DatabaseConfig,
    }),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      isGlobal: true,
      useFactory: async (configService: ConfigService) => {
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
      },
    }),
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
