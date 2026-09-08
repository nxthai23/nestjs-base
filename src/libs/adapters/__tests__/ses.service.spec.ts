import { ConfigService } from '@nestjs/config';
import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import { SesService } from '../ses.service';
import { MailError, OutgoingMail } from '@libs/ports/mail.interface';

function makeConfig(overrides: Record<string, unknown> = {}) {
  return new ConfigService({
    mail: {
      ses: {
        region: 'ap-southeast-1',
        accessKeyId: 'AKIAEXAMPLE',
        secretAccessKey: 'secret',
        ...overrides,
      },
    },
  });
}

function mail(overrides: Partial<OutgoingMail> = {}): OutgoingMail {
  return {
    from: 'no-reply@example.com',
    to: ['user@example.com'],
    subject: 'Reset your password',
    html: '<p>hello</p>',
    cc: [],
    bcc: [],
    replyTo: [],
    ...overrides,
  };
}

function stubSend(response: unknown = { MessageId: 'ses-1' }) {
  return vi
    .spyOn(SESv2Client.prototype, 'send')
    .mockResolvedValue(response as never);
}

describe('SesService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends through SendEmailCommand with the addresses in the destination', async () => {
    const send = stubSend();
    const ses = new SesService(makeConfig());

    await ses.send(
      mail({
        to: ['a@example.com', 'b@example.com'],
        cc: ['c@example.com'],
        bcc: ['d@example.com'],
        replyTo: ['reply@example.com'],
      }),
    );

    const command = send.mock.calls[0][0] as SendEmailCommand;
    expect(command).toBeInstanceOf(SendEmailCommand);
    expect(command.input).toMatchObject({
      FromEmailAddress: 'no-reply@example.com',
      Destination: {
        ToAddresses: ['a@example.com', 'b@example.com'],
        CcAddresses: ['c@example.com'],
        BccAddresses: ['d@example.com'],
      },
      ReplyToAddresses: ['reply@example.com'],
    });
  });

  it('puts the subject and html body in simple content', async () => {
    const send = stubSend();
    const ses = new SesService(makeConfig());

    await ses.send(mail({ subject: 'Welcome', html: '<p>hi</p>' }));

    const command = send.mock.calls[0][0] as SendEmailCommand;
    expect(command.input.Content?.Simple).toMatchObject({
      Subject: { Data: 'Welcome' },
      Body: { Html: { Data: '<p>hi</p>' } },
    });
  });

  it('sends a text-only message without an empty html part', async () => {
    const send = stubSend();
    const ses = new SesService(makeConfig());

    await ses.send(mail({ html: undefined, text: 'plain body' }));

    const body = (send.mock.calls[0][0] as SendEmailCommand).input.Content
      ?.Simple?.Body;
    expect(body?.Text).toMatchObject({ Data: 'plain body' });
    expect(body?.Html).toBeUndefined();
  });

  it('sends both parts when both are given', async () => {
    const send = stubSend();
    const ses = new SesService(makeConfig());

    await ses.send(mail({ html: '<p>hi</p>', text: 'hi' }));

    const body = (send.mock.calls[0][0] as SendEmailCommand).input.Content
      ?.Simple?.Body;
    expect(body?.Html).toBeDefined();
    expect(body?.Text).toBeDefined();
  });

  it('returns the provider message id', async () => {
    stubSend({ MessageId: 'ses-abc' });
    const ses = new SesService(makeConfig());

    await expect(ses.send(mail())).resolves.toEqual({ messageId: 'ses-abc' });
  });

  it('wraps provider failures in MailError so SDK error shapes stay contained', async () => {
    const sdkError = Object.assign(new Error('Email address is not verified'), {
      name: 'MessageRejected',
      $metadata: { httpStatusCode: 400 },
    });
    vi.spyOn(SESv2Client.prototype, 'send').mockRejectedValue(sdkError);
    const ses = new SesService(makeConfig());

    const failure = await ses
      .send(mail({ to: ['user@example.com'] }))
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(MailError);
    expect(failure).toMatchObject({
      operation: 'send',
      recipient: ['user@example.com'],
      cause: sdkError,
    });
  });

  it('omits cc, bcc and reply-to rather than sending empty lists', async () => {
    const send = stubSend();
    const ses = new SesService(makeConfig());

    await ses.send(mail());

    const { Destination, ReplyToAddresses } = (
      send.mock.calls[0][0] as SendEmailCommand
    ).input;
    expect(Destination?.CcAddresses).toBeUndefined();
    expect(Destination?.BccAddresses).toBeUndefined();
    expect(ReplyToAddresses).toBeUndefined();
  });
});
