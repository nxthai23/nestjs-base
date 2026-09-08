import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import {
  MailError,
  MailInterface,
  OutgoingMail,
} from '@libs/ports/mail.interface';

export interface SesOptions {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/**
 * Amazon SES, through the v2 API.
 *
 * Uses `Simple` content rather than `Raw`: the port carries no attachments, so
 * there is no MIME to assemble, and SES does the encoding. Adding attachments
 * later means moving to `Raw` and building the MIME document here — which is
 * why the port does not promise them today.
 */
@Injectable()
export class SesService implements MailInterface {
  private readonly client: SESv2Client;

  constructor(config: ConfigService) {
    const options = this.readOptions(config);

    this.client = new SESv2Client({
      region: options.region,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
    });
  }

  protected readOptions(config: ConfigService): SesOptions {
    return {
      region: config.getOrThrow<string>('mail.ses.region'),
      accessKeyId: config.getOrThrow<string>('mail.ses.accessKeyId'),
      secretAccessKey: config.getOrThrow<string>('mail.ses.secretAccessKey'),
    };
  }

  async send(mail: OutgoingMail): Promise<{ messageId: string }> {
    try {
      const response = await this.client.send(
        new SendEmailCommand({
          FromEmailAddress: mail.from,
          Destination: {
            ToAddresses: mail.to,
            // Undefined rather than [], so the request carries the field only
            // when it means something.
            CcAddresses: optional(mail.cc),
            BccAddresses: optional(mail.bcc),
          },
          ReplyToAddresses: optional(mail.replyTo),
          Content: {
            Simple: {
              Subject: { Data: mail.subject },
              Body: {
                Html: mail.html ? { Data: mail.html } : undefined,
                Text: mail.text ? { Data: mail.text } : undefined,
              },
            },
          },
        }),
      );

      return { messageId: response.MessageId };
    } catch (error) {
      throw new MailError('send', mail.to, error);
    }
  }
}

function optional(addresses: string[]): string[] | undefined {
  return addresses.length ? addresses : undefined;
}
