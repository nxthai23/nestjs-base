import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { MailInterface, OutgoingMail } from '@libs/ports/mail.interface';

/**
 * Writes the mail to the log instead of sending it. The default driver, so the
 * application boots and the e2e suite runs with no provider credentials — and
 * a developer running against production data cannot accidentally mail real
 * users.
 *
 * Named `log-mail` rather than `log` because `core/modules/logger` is a
 * different concern entirely; this is a mail driver, not logging.
 */
@Injectable()
export class LogMailService implements MailInterface {
  private readonly logger = new Logger('Mail');

  async send(mail: OutgoingMail): Promise<{ messageId: string }> {
    const messageId = randomUUID();
    const parts = [
      `[not sent: log driver]`,
      `id=${messageId}`,
      `from=${mail.from}`,
      `to=${mail.to.join(', ')}`,
    ];

    if (mail.cc.length) parts.push(`cc=${mail.cc.join(', ')}`);
    if (mail.bcc.length) parts.push(`bcc=${mail.bcc.join(', ')}`);
    if (mail.replyTo.length) parts.push(`reply-to=${mail.replyTo.join(', ')}`);

    // The body is deliberately absent: it is often a whole rendered template,
    // and it routinely carries reset links and other one-time secrets.
    parts.push(`subject=${JSON.stringify(mail.subject)}`);

    this.logger.log(parts.join(' '));

    return { messageId };
  }
}
