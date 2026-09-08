import { MailError } from '../mail.interface';

describe('MailError', () => {
  it('names the failed operation and recipient in its message', () => {
    const error = new MailError('send', 'user@example.com');

    expect(error.message).toBe('Mail send failed for "user@example.com"');
    expect(error.name).toBe('MailError');
    expect(error).toBeInstanceOf(Error);
  });

  it('keeps the underlying provider error reachable as cause', () => {
    const providerError = new Error('550 rejected');
    const error = new MailError('send', 'user@example.com', providerError);

    expect(error.operation).toBe('send');
    expect(error.recipient).toBe('user@example.com');
    expect(error.cause).toBe(providerError);
  });

  // Mail goes to several people; the message should say who it was for
  // without turning into an unbounded list in the logs.
  it('summarises a large recipient list rather than printing all of it', () => {
    const many = Array.from({ length: 40 }, (_, i) => `user${i}@example.com`);

    const error = new MailError('send', many);

    expect(error.message).toContain('user0@example.com');
    expect(error.message).toContain('40 recipients');
    expect(error.message.length).toBeLessThan(120);
  });
});
