import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService as SendgridClient } from '@sendgrid/mail';
import {
  MailError,
  MailInterface,
  OutgoingMail,
} from '@libs/ports/mail.interface';

export interface SendgridOptions {
  apiKey: string;
}

/**
 * SendGrid.
 *
 * The package's default export is a configured singleton; this constructs its
 * own `MailService` instead, so two adapters — or two tests — cannot overwrite
 * each other's API key through shared global state.
 */
@Injectable()
export class SendgridService implements MailInterface {
  private readonly client: SendgridClient;

  constructor(config: ConfigService) {
    const options = this.readOptions(config);

    this.client = new SendgridClient();
    this.client.setApiKey(options.apiKey);
  }

  protected readOptions(config: ConfigService): SendgridOptions {
    return {
      apiKey: config.getOrThrow<string>('mail.sendgrid.apiKey'),
    };
  }

  async send(mail: OutgoingMail): Promise<{ messageId: string }> {
    try {
      const [response] = await this.client.send({
        from: mail.from,
        to: mail.to,
        cc: mail.cc.length ? mail.cc : undefined,
        bcc: mail.bcc.length ? mail.bcc : undefined,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        // SendGrid splits these by arity: one address belongs in `replyTo`,
        // several in `replyToList`, and each rejects the other's shape.
        ...replyTo(mail.replyTo),
      } as Parameters<SendgridClient['send']>[0]);

      // SendGrid reports the id in a header rather than the body; fall back to
      // a local id so callers always have something to correlate on.
      const headerId = response?.headers?.['x-message-id'];

      return { messageId: headerId ? String(headerId) : randomUUID() };
    } catch (error) {
      throw new MailError('send', mail.to, error);
    }
  }
}

function replyTo(addresses: string[]) {
  if (addresses.length === 0) return {};
  if (addresses.length === 1) return { replyTo: addresses[0] };
  return { replyToList: addresses.map((email) => ({ email })) };
}
