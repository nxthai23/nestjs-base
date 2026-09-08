import {
  MiddlewareConsumer,
  Module,
  NestModule,
  ValidationPipe,
} from '@nestjs/common';
import { UserModule } from './api/user/user.module';
import { AuthModule } from './api/auth/auth.module';
import { HealthModule } from './api/health/health.module';
import { ConfigModule } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import configuration from './config/configuration';
import { APP_PIPE } from '@nestjs/core';
import { DatabaseConfig } from './core/database/database';
import { CachingModule } from '@core/modules/caching/caching.module';
import { MailModule } from '@core/modules/mail/mail.module';
import { AppConfigModule } from './api/app-config/app-config.module';
import { SeederModule } from '@core/database/seeder/seeder.module';
import { LoggerModule } from 'nestjs-pino';
import { loggerConfig } from '@core/modules/logger/pino.config';

@Module({
  imports: [
    LoggerModule.forRoot(loggerConfig),
    UserModule,
    AuthModule,
    HealthModule,
    ConfigModule.forRoot({
      isGlobal: true,
      cache: false,
      load: [configuration],
    }),
    MikroOrmModule.forRootAsync({
      useClass: DatabaseConfig,
    }),
    SeederModule,
    // Global. Driver comes from CACHE_DRIVER and defaults to in-memory, so
    // this boots with no cache configuration at all.
    CachingModule.forRootAsync(),
    // Global. Driver comes from MAIL_DRIVER and defaults to the log driver,
    // so this boots with no provider credentials and sends nothing.
    MailModule.forRootAsync(),
    AppConfigModule,
  ],
  providers: [
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
  ],
})
export class AppModule implements NestModule {
  configure(_consumer: MiddlewareConsumer) {
    // LoggerMiddleware is disabled - using pino-http from LoggerModule instead
    // consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
