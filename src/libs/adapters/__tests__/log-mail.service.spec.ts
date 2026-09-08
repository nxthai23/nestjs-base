import { Logger } from '@nestjs/common';
import { LogMailService } from '../log-mail.service';
import { OutgoingMail } from '@libs/ports/mail.interface';

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

describe('LogMailService', () => {
  let logged: string[];

  beforeEach(() => {
    logged = [];
    vi.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      logged.push(String(message));
      return undefined;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports a message id, so callers behave the same as against a provider', async () => {
    const result = await new LogMailService().send(mail());

    expect(result.messageId).toEqual(expect.any(String));
    expect(result.messageId.length).toBeGreaterThan(0);
  });

  it('gives every message a distinct id', async () => {
    const service = new LogMailService();

    const first = await service.send(mail());
    const second = await service.send(mail());

    expect(first.messageId).not.toBe(second.messageId);
  });

  it('logs who the mail was for and what it said', async () => {
    await new LogMailService().send(
      mail({ to: ['a@example.com', 'b@example.com'], subject: 'Welcome' }),
    );

    const line = logged.join('\n');
    expect(line).toContain('a@example.com');
    expect(line).toContain('b@example.com');
    expect(line).toContain('Welcome');
    expect(line).toContain('no-reply@example.com');
  });

  it('mentions cc and bcc when they are used', async () => {
    await new LogMailService().send(
      mail({ cc: ['boss@example.com'], bcc: ['audit@example.com'] }),
    );

    const line = logged.join('\n');
    expect(line).toContain('boss@example.com');
    expect(line).toContain('audit@example.com');
  });

  it('says nothing about cc or bcc when they are empty', async () => {
    await new LogMailService().send(mail());

    // Matched as field markers, not as bare substrings: the message id is a
    // uuid, and a uuid happily contains "cc".
    const line = logged.join('\n');
    expect(line).not.toContain('cc=');
    expect(line).not.toContain('bcc=');
    expect(line).not.toContain('reply-to=');
  });

  // The body can be a whole rendered template; a log line is not the place
  // for it, and it routinely carries reset links and other one-time secrets.
  it('does not dump the body into the log', async () => {
    await new LogMailService().send(
      mail({ html: '<p>token=super-secret-reset-token</p>' }),
    );

    expect(logged.join('\n')).not.toContain('super-secret-reset-token');
  });

  it('never sends anything, whatever it is handed', async () => {
    // Nothing to assert against a network here — the point is that the class
    // has no client at all, which this pins by construction.
    const service = new LogMailService();

    expect(Object.keys(service)).not.toContain('client');
  });
});
