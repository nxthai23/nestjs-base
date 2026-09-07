import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CachingService } from '@core/modules/caching/caching.service';
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
  constructor(
    private caching: CachingService,
    private configService: ConfigService,
  ) {
    // change the chain based on the environment
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    this.publicClient = createPublicClient({
      chain: !isProd ? abstractTestnet : abstract,
      transport: http(),
    });
  }

  async getNonce(walletAddress: string): Promise<string> {
    const existedNonce = await this.caching.get<string>(walletAddress);
    if (existedNonce) return existedNonce;
    const nonce = generateNonce();
    await this.caching.set(walletAddress, nonce, NONCE_TTL_SECONDS);
    return nonce;
  }

  async verify(walletAddress: string, signature: string, message: string) {
    try {
      const siweMessage = new SiweMessage(message);
      // Verify nonce
      const nonce = siweMessage.nonce;

      if (!nonce) {
        throw new BadRequestException('Nonce is missing');
      }

      const existedNonce = await this.caching.get<string>(walletAddress);

      if (!existedNonce) {
        throw new BadRequestException('Invalid nonce');
      }

      // Verify signature
      const isValidSignature = this.publicClient.verifySiweMessage({
        message: message,
        signature: signature as `0x${string}`,
        nonce,
      });

      if (!isValidSignature) {
        throw new BadRequestException('Invalid signature');
      }

      // @TODO: add user or do logic here
      return true;
    } catch (error) {
      throw error;
    }
  }
}
