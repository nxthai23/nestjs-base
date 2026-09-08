import { ConfigService } from '@nestjs/config';
import { MailService as SendgridClient } from '@sendgrid/mail';
import { SendgridService } from '../sendgrid.service';
import { MailError, OutgoingMail } from '@libs/ports/mail.interface';

function makeConfig(overrides: Record<string, unknown> = {}) {
  return new ConfigService({
    mail: { sendgrid: { apiKey: 'SG.test-key', ...overrides } },
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

function stubSend(
  headers: Record<string, string> = { 'x-message-id': 'sg-1' },
) {
  return vi
    .spyOn(SendgridClient.prototype, 'send')
    .mockResolvedValue([{ statusCode: 202, body: {}, headers }, {}] as never);
}

/** The payload handed to the SDK. */
function payloadOf(send: ReturnType<typeof stubSend>) {
  return send.mock.calls[0][0] as Record<string, unknown>;
}

describe('SendgridService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // The package's default export is a singleton, so two adapters - or two
  // tests - would overwrite each other's API key. This uses its own client.
  it('holds its own client rather than the package singleton', () => {
    const setApiKey = vi
      .spyOn(SendgridClient.prototype, 'setApiKey')
      .mockReturnValue(undefined);

    const first = new SendgridService(makeConfig({ apiKey: 'SG.first' }));
    const second = new SendgridService(makeConfig({ apiKey: 'SG.second' }));

    expect(setApiKey).toHaveBeenNthCalledWith(1, 'SG.first');
    expect(setApiKey).toHaveBeenNthCalledWith(2, 'SG.second');
    expect(clientOf(first)).not.toBe(clientOf(second));
  });

  it('maps the addresses onto the payload', async () => {
    const send = stubSend();
    const sendgrid = new SendgridService(makeConfig());

    await sendgrid.send(
      mail({
        to: ['a@example.com', 'b@example.com'],
        cc: ['c@example.com'],
        bcc: ['d@example.com'],
      }),
    );

    expect(payloadOf(send)).toMatchObject({
      from: 'no-reply@example.com',
      to: ['a@example.com', 'b@example.com'],
      cc: ['c@example.com'],
      bcc: ['d@example.com'],
      subject: 'Reset your password',
      html: '<p>hello</p>',
    });
  });

  // SendGrid splits these: one address goes in replyTo, several in
  // replyToList, and sending an array to the wrong one is rejected.
  it('uses replyTo for a single address', async () => {
    const send = stubSend();
    const sendgrid = new SendgridService(makeConfig());

    await sendgrid.send(mail({ replyTo: ['reply@example.com'] }));

    expect(payloadOf(send)).toMatchObject({ replyTo: 'reply@example.com' });
    expect(payloadOf(send).replyToList).toBeUndefined();
  });

  it('uses replyToList for several addresses', async () => {
    const send = stubSend();
    const sendgrid = new SendgridService(makeConfig());

    await sendgrid.send(
      mail({ replyTo: ['one@example.com', 'two@example.com'] }),
    );

    expect(payloadOf(send)).toMatchObject({
      replyToList: [{ email: 'one@example.com' }, { email: 'two@example.com' }],
    });
    expect(payloadOf(send).replyTo).toBeUndefined();
  });

  it('omits cc, bcc and reply-to rather than sending empty lists', async () => {
    const send = stubSend();
    const sendgrid = new SendgridService(makeConfig());

    await sendgrid.send(mail());

    const payload = payloadOf(send);
    expect(payload.cc).toBeUndefined();
    expect(payload.bcc).toBeUndefined();
    expect(payload.replyTo).toBeUndefined();
    expect(payload.replyToList).toBeUndefined();
  });

  it('sends a text-only message without an empty html field', async () => {
    const send = stubSend();
    const sendgrid = new SendgridService(makeConfig());

    await sendgrid.send(mail({ html: undefined, text: 'plain body' }));

    expect(payloadOf(send).text).toBe('plain body');
    expect(payloadOf(send).html).toBeUndefined();
  });

  it('reports the message id the provider assigned', async () => {
    stubSend({ 'x-message-id': 'sg-abc' });
    const sendgrid = new SendgridService(makeConfig());

    await expect(sendgrid.send(mail())).resolves.toEqual({
      messageId: 'sg-abc',
    });
  });

  it('still returns a message id when the provider sends no header', async () => {
    stubSend({});
    const sendgrid = new SendgridService(makeConfig());

    const { messageId } = await sendgrid.send(mail());

    expect(messageId).toEqual(expect.any(String));
    expect(messageId.length).toBeGreaterThan(0);
  });

  it('wraps provider failures in MailError so SDK error shapes stay contained', async () => {
    const providerError = Object.assign(new Error('Bad Request'), {
      code: 400,
      response: { body: { errors: [{ message: 'from is not verified' }] } },
    });
    vi.spyOn(SendgridClient.prototype, 'send').mockRejectedValue(providerError);
    const sendgrid = new SendgridService(makeConfig());

    const failure = await sendgrid
      .send(mail({ to: ['user@example.com'] }))
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(MailError);
    expect(failure).toMatchObject({
      operation: 'send',
      recipient: ['user@example.com'],
      cause: providerError,
    });
  });
});

function clientOf(service: SendgridService): unknown {
  return (service as unknown as { client: unknown }).client;
}
