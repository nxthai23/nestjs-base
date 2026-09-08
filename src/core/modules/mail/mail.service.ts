import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MailInterface,
  OutgoingMail,
  SendMailInput,
} from '@libs/ports/mail.interface';
import { MAIL_ADAPTER } from './mail.constant';

/**
 * The mail entry point for the rest of the app.
 *
 * It does two things beyond delegating, both so the adapters stay the shape of
 * their own SDK call and nothing more:
 *
 * - **Normalises.** A caller may pass one address or many; adapters always
 *   receive lists, a resolved `from`, and trimmed addresses.
 * - **Refuses nonsense early.** The providers fail differently and late — SES
 *   rejects an empty destination with a 400 off the wire, and a message with
 *   no body is happily delivered blank. Catching it here gives one behaviour
 *   and one error, whichever driver is wired.
 *
 * Unlike caching, this does **not** fail open. A password-reset mail that was
 * never sent has to reach the caller as a failure, not a log line.
 */
@Injectable()
export class MailService {
  private readonly defaultFrom?: string;

  constructor(
    @Inject(MAIL_ADAPTER) private readonly adapter: MailInterface,
    config: ConfigService,
  ) {
    this.defaultFrom = config.get<string>('mail.from');
  }

  // async so a rejected message surfaces as a rejected promise like any
  // provider failure, rather than throwing before the caller has a promise.
  async send(input: SendMailInput): Promise<{ messageId: string }> {
    return this.adapter.send(this.prepare(input));
  }

  private prepare(input: SendMailInput): OutgoingMail {
    const to = addresses(input.to);
    if (to.length === 0) {
      throw new BadRequestException('Mail needs at least one recipient');
    }

    const subject = input.subject?.trim();
    if (!subject) {
      throw new BadRequestException('Mail needs a subject');
    }

    if (!input.html?.trim() && !input.text?.trim()) {
      throw new BadRequestException('Mail needs an html or text body');
    }

    const from = input.from?.trim() || this.defaultFrom;
    if (!from) {
      throw new BadRequestException(
        'No sender for this mail: set MAIL_FROM, or pass `from`',
      );
    }

    return {
      from,
      to,
      subject,
      html: input.html,
      text: input.text,
      cc: addresses(input.cc),
      bcc: addresses(input.bcc),
      replyTo: addresses(input.replyTo),
    };
  }
}

/** One address or many, trimmed, with the blanks dropped. */
function addresses(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  const list = Array.isArray(value) ? value : [value];
  return list.map((address) => address.trim()).filter(Boolean);
}
