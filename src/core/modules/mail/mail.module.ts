import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MAIL_DEFAULTS, MailInterface } from '@libs/ports/mail.interface';
import { hasOwn, MailDriver, registry } from '@libs/registry';
import { MAIL_ADAPTER } from './mail.constant';
import { MailService } from './mail.service';

@Module({})
export class MailModule {
  static forRootAsync(): DynamicModule {
    return {
      module: MailModule,
      global: true,
      imports: [ConfigModule],
      providers: [
        {
          provide: MAIL_ADAPTER,
          inject: [ConfigService],
          useFactory: (config: ConfigService): MailInterface => {
            // Defaults to the log driver, so the app boots with no provider
            // credentials and nobody mails real users by accident.
            const driver = config.get<MailDriver>(
              'mail.driver',
              MAIL_DEFAULTS.driver,
            );
            // An own-property check — see caching.module.ts for what a plain
            // lookup lets through.
            if (!hasOwn(registry.mail, driver)) {
              throw new Error(`Unknown MAIL_DRIVER: ${driver}`);
            }
            return new registry.mail[driver](config);
          },
        },
        MailService,
      ],
      exports: [MailService],
    };
  }
}
