import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateNonce, SiweMessage } from 'siwe';
import { createPublicClient, http } from 'viem';
import { abstract, abstractTestnet } from 'viem/chains';

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
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
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
    const existedNonce = await this.cacheManager.get<string>(walletAddress);
    if (existedNonce) return existedNonce;
    const nonce = generateNonce();
    await this.cacheManager.set(walletAddress, nonce, 300); // Store nonce for 5 minutes
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

      const existedNonce = await this.cacheManager.get<string>(walletAddress);

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
