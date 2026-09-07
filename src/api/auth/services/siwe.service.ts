import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CachingService } from '@core/modules/caching/caching.service';
import { NamespacedCache } from '@libs/ports/caching.interface';
import { generateNonce, SiweMessage } from 'siwe';
import { createPublicClient, http } from 'viem';
import { abstract, abstractTestnet } from 'viem/chains';

/** How long an issued nonce stays valid. The caching port measures in seconds. */
const NONCE_TTL_SECONDS = 5 * 60;

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

  constructor(
    caching: CachingService,
    private configService: ConfigService,
  ) {
    this.nonces = caching.namespace('siwe:nonce');
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
    const siweMessage = new SiweMessage(message);
    const nonce = siweMessage.nonce;

    if (!nonce) {
      throw new BadRequestException('Nonce is missing');
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
