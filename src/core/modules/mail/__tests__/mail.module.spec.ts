import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { MailModule } from '../mail.module';
import { MailService } from '../mail.service';
import { MAIL_ADAPTER } from '../mail.constant';
import { LogMailService } from '@libs/adapters/log-mail.service';
import { SesService } from '@libs/adapters/ses.service';
import { SendgridService } from '@libs/adapters/sendgrid.service';

const mailConfig = {
  from: 'no-reply@example.com',
  ses: {
    region: 'ap-southeast-1',
    accessKeyId: 'AKIAEXAMPLE',
    secretAccessKey: 'secret',
  },
  sendgrid: { apiKey: 'SG.test-key' },
};

function compileWithDriver(driver: string) {
  return Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        load: [() => ({ mail: { driver, ...mailConfig } })],
      }),
      MailModule.forRootAsync(),
    ],
  }).compile();
}

describe('MailModule', () => {
  it.each([
    ['log', LogMailService],
    ['ses', SesService],
    ['sendgrid', SendgridService],
  ])(
    'wires the %s adapter — no calling code changes',
    async (driver, Adapter) => {
      const moduleRef = await compileWithDriver(driver);

      expect(moduleRef.get(MAIL_ADAPTER)).toBeInstanceOf(Adapter);
    },
  );

  it('fails at boot when the driver is not in the registry', async () => {
    await expect(compileWithDriver('mailgun')).rejects.toThrow(
      /Unknown MAIL_DRIVER: mailgun/,
    );
  });

  // Same hole the caching and storage modules had: a plain object lookup
  // answers for Object.prototype too.
  it.each(['constructor', 'toString'])(
    'rejects %s rather than resolving it off Object.prototype',
    async (driver) => {
      await expect(compileWithDriver(driver)).rejects.toThrow(
        new RegExp(`Unknown MAIL_DRIVER: ${driver}`),
      );
    },
  );

  it('exports the facade for feature code', async () => {
    const moduleRef = await compileWithDriver('log');

    expect(moduleRef.get(MailService)).toBeInstanceOf(MailService);
  });

  it('boots with no configuration at all, since log is the default driver', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [() => ({})] }),
        MailModule.forRootAsync(),
      ],
    }).compile();

    expect(moduleRef.get(MAIL_ADAPTER)).toBeInstanceOf(LogMailService);
  });
});
