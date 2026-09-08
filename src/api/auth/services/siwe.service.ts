import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CachingService } from '@core/modules/caching/caching.service';
import { NamespacedCache } from '@libs/ports/caching.interface';
import { generateNonce, SiweMessage } from 'siwe';
import { createPublicClient, http } from 'viem';
import { abstract, abstractTestnet } from 'viem/chains';

/** How long an issued nonce stays valid. The caching port measures in seconds. */
const NONCE_TTL_SECONDS = 5 * 60;

/**
 * Ethereum addresses travel both checksummed and lowercased, and the same
 * wallet must compare equal either way.
 */
function isSameAddress(a: string | undefined, b: string | undefined): boolean {
  return Boolean(a) && Boolean(b) && a.toLowerCase() === b.toLowerCase();
}

/**
 * SIWE = Sign-In with Ethereum
 * This service handles the authentication logic for SIWE.
 * @see: https://docs.login.xyz/sign-in-with-ethereum/quickstart-guide/creating-siwe-messages
 * @see: viem docs: https://viem.sh/docs/getting-started
 */
@Injectable()
export class SiweService {
  private publicClient;

  /**
   * Nonces are keyed by wallet address - an identifier other features will
   * reach for too. The namespace is what stops one of them overwriting a
   * nonce, which would look like a random login failure.
   */
  private readonly nonces: NamespacedCache;

  private readonly logger = new Logger(SiweService.name);

  /**
   * The domain a signature must have been produced for. Without it a signature
   * obtained from a prompt on any other site replays here, since the nonce is
   * then the only thing binding the message to us.
   *
   * Deliberately read from configuration rather than the request's Host
   * header: that header is supplied by the caller, so checking against it
   * would be checking a value against itself.
   */
  private readonly domain?: string;

  constructor(
    caching: CachingService,
    private configService: ConfigService,
  ) {
    this.nonces = caching.namespace('siwe:nonce');
    this.domain = this.configService.get<string>('appDomain');
    if (!this.domain) {
      this.logger.warn(
        'APP_DOMAIN is not set, so SIWE domain binding is off: a signature ' +
          'produced for another site will be accepted. Set it before ' +
          'exposing SIWE login.',
      );
    }
    // change the chain based on the environment
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    this.publicClient = createPublicClient({
      chain: !isProd ? abstractTestnet : abstract,
      transport: http(),
    });
  }

  async getNonce(walletAddress: string): Promise<string> {
    // Deliberately not reusing an outstanding nonce: a nonce is single-use, so
    // handing the same one back for the rest of its ttl would keep a captured
    // signature replayable for that whole window.
    const nonce = generateNonce();
    await this.nonces.set(walletAddress, nonce, NONCE_TTL_SECONDS);
    return nonce;
  }

  async verify(walletAddress: string, signature: string, message: string) {
    // `message` is request input and the parser throws on anything it cannot
    // read, which unwrapped surfaces as a 500 for what is a client mistake.
    let siweMessage: SiweMessage;
    try {
      siweMessage = new SiweMessage(message);
    } catch {
      throw new BadRequestException('Malformed SIWE message');
    }

    const nonce = siweMessage.nonce;

    if (!nonce) {
      throw new BadRequestException('Nonce is missing');
    }

    // The signature is checked against the address *inside* the message, while
    // the nonce is looked up by `walletAddress`. Without this the two are
    // unrelated: request a nonce for someone else's wallet, sign a message
    // carrying your own address and that nonce, and the caller is told the
    // other wallet authenticated. Compared case-insensitively because clients
    // send addresses both checksummed and lowercased.
    if (!isSameAddress(siweMessage.address, walletAddress)) {
      throw new BadRequestException('Address mismatch');
    }

    const issuedNonce = await this.nonces.get<string>(walletAddress);

    // The nonce carried by the message is attacker-controlled, so proving one
    // exists for this wallet is not enough — it has to be the one we issued.
    if (!issuedNonce || issuedNonce !== nonce) {
      throw new BadRequestException('Invalid nonce');
    }

    const isValidSignature = await this.publicClient.verifySiweMessage({
      message: message,
      signature: signature as `0x${string}`,
      nonce,
      // Belt and braces: viem enforces both of these itself, so the checks
      // survive someone rewriting the guards above.
      address: walletAddress,
      ...(this.domain ? { domain: this.domain } : {}),
    });

    if (!isValidSignature) {
      throw new BadRequestException('Invalid signature');
    }

    // Consume the nonce. Without this the same signature verifies again for
    // the remainder of the ttl.
    await this.nonces.delete(walletAddress);

    // @TODO: add user or do logic here
    return true;
  }
}
