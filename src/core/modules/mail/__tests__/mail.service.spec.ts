import { BadRequestException } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { MailService } from '../mail.service';
import { MAIL_ADAPTER } from '../mail.constant';
import { MailInterface, OutgoingMail } from '@libs/ports/mail.interface';

function makeFakeAdapter(): MailInterface {
  return { send: vi.fn().mockResolvedValue({ messageId: 'id-1' }) };
}

async function build(adapter: MailInterface, from = 'no-reply@example.com') {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        load: [() => ({ mail: { from } })],
      }),
    ],
    providers: [MailService, { provide: MAIL_ADAPTER, useValue: adapter }],
  }).compile();

  return moduleRef.get(MailService);
}

/** What actually reached the adapter. */
function sent(adapter: MailInterface): OutgoingMail {
  return (adapter.send as ReturnType<typeof vi.fn>).mock
    .calls[0][0] as OutgoingMail;
}

describe('MailService', () => {
  describe('delegation', () => {
    it('passes the message to whichever adapter is wired in', async () => {
      const adapter = makeFakeAdapter();
      const mail = await build(adapter);

      await expect(
        mail.send({ to: 'user@example.com', subject: 'Hi', text: 'hello' }),
      ).resolves.toEqual({ messageId: 'id-1' });
      expect(adapter.send).toHaveBeenCalledOnce();
    });

    // Unlike caching, mail does not fail open: a password reset that was
    // never sent has to be visible to the caller, not swallowed into a log.
    it('lets a provider failure reach the caller', async () => {
      const adapter = makeFakeAdapter();
      (adapter.send as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('provider down'),
      );
      const mail = await build(adapter);

      await expect(
        mail.send({ to: 'user@example.com', subject: 'Hi', text: 'hello' }),
      ).rejects.toThrow('provider down');
    });
  });

  describe('normalising', () => {
    it('turns a single address into a list, so adapters need no branch', async () => {
      const adapter = makeFakeAdapter();
      const mail = await build(adapter);

      await mail.send({
        to: 'user@example.com',
        cc: 'boss@example.com',
        bcc: 'audit@example.com',
        replyTo: 'reply@example.com',
        subject: 'Hi',
        text: 'hello',
      });

      expect(sent(adapter)).toMatchObject({
        to: ['user@example.com'],
        cc: ['boss@example.com'],
        bcc: ['audit@example.com'],
        replyTo: ['reply@example.com'],
      });
    });

    it('gives empty lists rather than undefined for the optional addresses', async () => {
      const adapter = makeFakeAdapter();
      const mail = await build(adapter);

      await mail.send({ to: 'user@example.com', subject: 'Hi', text: 'x' });

      expect(sent(adapter)).toMatchObject({ cc: [], bcc: [], replyTo: [] });
    });

    it('fills in the configured sender', async () => {
      const adapter = makeFakeAdapter();
      const mail = await build(adapter, 'system@example.com');

      await mail.send({ to: 'user@example.com', subject: 'Hi', text: 'x' });

      expect(sent(adapter).from).toBe('system@example.com');
    });

    it('lets a message override the sender', async () => {
      const adapter = makeFakeAdapter();
      const mail = await build(adapter, 'system@example.com');

      await mail.send({
        to: 'user@example.com',
        from: 'billing@example.com',
        subject: 'Hi',
        text: 'x',
      });

      expect(sent(adapter).from).toBe('billing@example.com');
    });

    it('drops blank addresses instead of passing them to the provider', async () => {
      const adapter = makeFakeAdapter();
      const mail = await build(adapter);

      await mail.send({
        to: ['user@example.com', '  ', ''],
        subject: 'Hi',
        text: 'x',
      });

      expect(sent(adapter).to).toEqual(['user@example.com']);
    });

    it('trims surrounding whitespace off addresses', async () => {
      const adapter = makeFakeAdapter();
      const mail = await build(adapter);

      await mail.send({
        to: '  user@example.com ',
        subject: 'Hi',
        text: 'x',
      });

      expect(sent(adapter).to).toEqual(['user@example.com']);
    });
  });

  /**
   * Rejected here rather than in each adapter: the providers fail differently
   * and late — SES rejects an empty destination with a 400 from the wire, and
   * a message with no body is accepted and delivered blank.
   */
  describe('refusing to send nonsense', () => {
    it('rejects a message with no recipient', async () => {
      const adapter = makeFakeAdapter();
      const mail = await build(adapter);

      await expect(
        mail.send({ to: [], subject: 'Hi', text: 'x' }),
      ).rejects.toThrow(BadRequestException);
      expect(adapter.send).not.toHaveBeenCalled();
    });

    it('rejects a message whose recipients are all blank', async () => {
      const adapter = makeFakeAdapter();
      const mail = await build(adapter);

      await expect(
        mail.send({ to: ['   '], subject: 'Hi', text: 'x' }),
      ).rejects.toThrow(/recipient/i);
    });

    it('rejects a message with neither html nor text', async () => {
      const adapter = makeFakeAdapter();
      const mail = await build(adapter);

      await expect(
        mail.send({ to: 'a@example.com', subject: 'Hi' }),
      ).rejects.toThrow(/body/i);
      expect(adapter.send).not.toHaveBeenCalled();
    });

    it('rejects a message with no subject', async () => {
      const adapter = makeFakeAdapter();
      const mail = await build(adapter);

      await expect(
        mail.send({ to: 'a@example.com', subject: '  ', text: 'x' }),
      ).rejects.toThrow(/subject/i);
    });

    it('rejects when no sender is configured and none is given', async () => {
      const adapter = makeFakeAdapter();
      const moduleRef = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            load: [() => ({ mail: {} })],
          }),
        ],
        providers: [MailService, { provide: MAIL_ADAPTER, useValue: adapter }],
      }).compile();

      await expect(
        moduleRef
          .get(MailService)
          .send({ to: 'a@example.com', subject: 'Hi', text: 'x' }),
      ).rejects.toThrow(/MAIL_FROM/);
    });
  });
});
