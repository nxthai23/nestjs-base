/**
 * What a caller hands to `MailService`. Addresses may be a single string or a
 * list, and `from` is optional — the facade fills it in from configuration.
 *
 * Addresses are plain strings so the port stays provider-neutral; the
 * `Name <address@example.com>` form is understood by both providers.
 */
export interface SendMailInput {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string | string[];
  /** Overrides the configured sender for this one message. */
  from?: string;
}

/**
 * What an adapter receives: every address is a list, `from` is resolved, and
 * the message is known to carry a body. Normalising in the facade rather than
 * in each adapter is what keeps `SesService` and `SendgridService` down to the
 * shape of their own SDK call.
 */
export interface OutgoingMail {
  from: string;
  to: string[];
  subject: string;
  html?: string;
  text?: string;
  cc: string[];
  bcc: string[];
  replyTo: string[];
}

/**
 * Transactional email. Deliberately no templating: templates are rendered in
 * the app and sent as HTML, so the two providers' template systems — which
 * live in different places and take different data — never reach this
 * contract. Swapping driver therefore never means rebuilding templates.
 */
export interface MailInterface {
  send(mail: OutgoingMail): Promise<{ messageId: string }>;
}

/** How many addresses a MailError prints before summarising. */
const NAMED_RECIPIENTS = 1;

export class MailError extends Error {
  constructor(
    readonly operation: string,
    readonly recipient: string | string[],
    readonly cause?: unknown,
  ) {
    super(`Mail ${operation} failed for ${describe(recipient)}`);
    this.name = 'MailError';
  }
}

/**
 * A single address in full; a list as its first address plus a count, so an
 * error about a 500-recipient send stays one readable line.
 */
function describe(recipient: string | string[]): string {
  const list = Array.isArray(recipient) ? recipient : [recipient];
  if (list.length <= NAMED_RECIPIENTS) {
    return `"${list.join(', ')}"`;
  }
  return `"${list[0]}" and ${list.length - NAMED_RECIPIENTS} more (${list.length} recipients)`;
}

export const MAIL_DEFAULTS = {
  /** Writes to the log instead of sending, so the app boots with no credentials. */
  driver: 'log',
} as const;
