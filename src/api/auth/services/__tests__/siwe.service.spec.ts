import { BadRequestException, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { generateNonce, SiweMessage } from 'siwe';
import { SiweService } from '../siwe.service';
import { CachingService } from '@core/modules/caching/caching.service';
import { CACHING_ADAPTER } from '@core/modules/caching/caching.constant';
import { MemoryService } from '@libs/adapters/memory.service';

const WALLET = '0x1111111111111111111111111111111111111111';

/** Where SiweService's namespace actually puts the nonce. */
const NONCE_KEY = `siwe:nonce:${WALLET}`;

async function build(appDomain?: string) {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        load: [() => ({ caching: { ttl: 60 }, appDomain })],
      }),
    ],
    providers: [
      SiweService,
      CachingService,
      {
        provide: CACHING_ADAPTER,
        inject: [ConfigService],
        useFactory: (config: ConfigService) => new MemoryService(config),
      },
    ],
  }).compile();

  return {
    siwe: moduleRef.get(SiweService),
    caching: moduleRef.get(CachingService),
  };
}

function messageWith(nonce: string, address = WALLET): string {
  return new SiweMessage({
    domain: 'example.com',
    address,
    uri: 'https://example.com',
    version: '1',
    chainId: 1,
    nonce,
  }).prepareMessage();
}

/**
 * Replaces the on-chain signature check. The point of these tests is what
 * SiweService does around that call, not viem's cryptography — and a real
 * check would need a live RPC endpoint.
 */
function stubSignatureCheck(siwe: SiweService, valid: boolean) {
  const verifySiweMessage = vi.fn().mockResolvedValue(valid);
  (siwe as unknown as { publicClient: unknown }).publicClient = {
    verifySiweMessage,
  };
  return verifySiweMessage;
}

describe('SiweService', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('issues a nonce and stores it against the wallet address', async () => {
    const { siwe, caching } = await build();

    const nonce = await siwe.getNonce(WALLET);

    expect(nonce).toEqual(expect.any(String));
    await expect(caching.get<string>(NONCE_KEY)).resolves.toBe(nonce);
  });

  // A nonce is single-use. Handing back an outstanding one would keep a
  // captured signature replayable for the rest of its ttl.
  it('issues a fresh nonce on every call and stores the latest', async () => {
    const { siwe, caching } = await build();

    const first = await siwe.getNonce(WALLET);
    const second = await siwe.getNonce(WALLET);

    expect(second).not.toBe(first);
    await expect(caching.get<string>(NONCE_KEY)).resolves.toBe(second);
  });

  // The nonce previously used cache-manager, whose ttl is in milliseconds, so
  // `set(address, nonce, 300)` expired it after 300ms rather than 5 minutes —
  // any signature arriving later than a third of a second was rejected.
  it('keeps the nonce alive well past a second', async () => {
    vi.useFakeTimers();
    const { siwe, caching } = await build();

    const nonce = await siwe.getNonce(WALLET);
    vi.advanceTimersByTime(60_000);

    await expect(caching.get<string>(NONCE_KEY)).resolves.toBe(nonce);
  });

  it('holds the nonce for five minutes, then lets it lapse', async () => {
    vi.useFakeTimers();
    const { siwe, caching } = await build();
    const first = await siwe.getNonce(WALLET);

    vi.advanceTimersByTime(299_000);
    await expect(caching.get<string>(NONCE_KEY)).resolves.toBe(first);

    vi.advanceTimersByTime(2_000);
    await expect(caching.get<string>(NONCE_KEY)).resolves.toBeUndefined();
  });

  it('rejects a verification when no nonce was ever issued', async () => {
    const { siwe } = await build();

    await expect(
      siwe.verify(WALLET, '0xsignature', messageWith(generateNonce())),
    ).rejects.toThrow('Invalid nonce');
  });

  // Proving *a* nonce exists for the wallet is not enough: the one carried by
  // the message is attacker-controlled and has to match what we issued.
  it('rejects a message carrying a nonce we never issued', async () => {
    const { siwe } = await build();
    const check = stubSignatureCheck(siwe, true);
    await siwe.getNonce(WALLET);

    await expect(
      siwe.verify(WALLET, '0xsignature', messageWith(generateNonce())),
    ).rejects.toThrow('Invalid nonce');
    expect(check).not.toHaveBeenCalled();
  });

  it('rejects a signature that does not check out', async () => {
    const { siwe } = await build();
    stubSignatureCheck(siwe, false);
    const nonce = await siwe.getNonce(WALLET);

    await expect(
      siwe.verify(WALLET, '0xnope', messageWith(nonce)),
    ).rejects.toThrow('Invalid signature');
  });

  it('accepts a valid signature and consumes the nonce', async () => {
    const { siwe, caching } = await build();
    stubSignatureCheck(siwe, true);
    const nonce = await siwe.getNonce(WALLET);
    const message = messageWith(nonce);

    await expect(siwe.verify(WALLET, '0xgood', message)).resolves.toBe(true);

    await expect(caching.get<string>(NONCE_KEY)).resolves.toBeUndefined();
    await expect(siwe.verify(WALLET, '0xgood', message)).rejects.toThrow(
      'Invalid nonce',
    );
  });

  /**
   * The nonce is looked up by `walletAddress`, but the signature is checked
   * against the address *inside* the message. Nothing tied the two together,
   * so: request a nonce for the victim, sign a message carrying your own
   * address and that nonce, and `verify(victim, ...)` returned true.
   */
  describe('binding the signature to the wallet being authenticated', () => {
    const ATTACKER = '0x2222222222222222222222222222222222222222';

    it('rejects a message signed by a different address than the one claimed', async () => {
      const { siwe } = await build();
      const check = stubSignatureCheck(siwe, true);
      const nonce = await siwe.getNonce(WALLET);

      await expect(
        siwe.verify(WALLET, '0xattacker', messageWith(nonce, ATTACKER)),
      ).rejects.toThrow('Address mismatch');
      expect(check).not.toHaveBeenCalled();
    });

    it('leaves the victim nonce intact when a mismatch is rejected', async () => {
      const { siwe, caching } = await build();
      stubSignatureCheck(siwe, true);
      const nonce = await siwe.getNonce(WALLET);

      await siwe
        .verify(WALLET, '0xattacker', messageWith(nonce, ATTACKER))
        .catch(() => undefined);

      await expect(caching.get<string>(NONCE_KEY)).resolves.toBe(nonce);
    });

    it('still accepts a lowercase address against a checksummed message', async () => {
      const { siwe } = await build();
      stubSignatureCheck(siwe, true);
      // Real EIP-55 checksum; the SIWE parser rejects anything else.
      const checksummed = '0xabC1111111111111111111111111111111111111';
      const nonce = await siwe.getNonce(checksummed.toLowerCase());

      await expect(
        siwe.verify(
          checksummed.toLowerCase(),
          '0xgood',
          messageWith(nonce, checksummed),
        ),
      ).resolves.toBe(true);
    });

    it('also hands the address to the verifier, so the check is not ours alone', async () => {
      const { siwe } = await build();
      const check = stubSignatureCheck(siwe, true);
      const nonce = await siwe.getNonce(WALLET);

      await siwe.verify(WALLET, '0xgood', messageWith(nonce));

      expect(check).toHaveBeenCalledWith(
        expect.objectContaining({ address: WALLET }),
      );
    });
  });

  /**
   * Without a domain the signature is only bound to a nonce, so one obtained
   * from a prompt on any other site replays here. EIP-4361 names domain
   * binding as the defence.
   */
  describe('domain binding', () => {
    it('passes the configured domain to the verifier', async () => {
      const { siwe } = await build('example.com');
      const check = stubSignatureCheck(siwe, true);
      const nonce = await siwe.getNonce(WALLET);

      await siwe.verify(WALLET, '0xgood', messageWith(nonce));

      expect(check).toHaveBeenCalledWith(
        expect.objectContaining({ domain: 'example.com' }),
      );
    });

    it('leaves the check off, rather than guessing, when no domain is configured', async () => {
      const { siwe } = await build(undefined);
      const check = stubSignatureCheck(siwe, true);
      const nonce = await siwe.getNonce(WALLET);

      await siwe.verify(WALLET, '0xgood', messageWith(nonce));

      expect(check.mock.calls[0][0]).not.toHaveProperty('domain');
    });

    it('warns at startup when the check is off, so it is not silently absent', async () => {
      const warn = vi
        .spyOn(Logger.prototype, 'warn')
        .mockReturnValue(undefined);

      await build(undefined);

      expect(warn).toHaveBeenCalledOnce();
      expect(String(warn.mock.calls[0][0])).toContain('APP_DOMAIN');
    });

    it('says nothing when the domain is configured', async () => {
      const warn = vi
        .spyOn(Logger.prototype, 'warn')
        .mockReturnValue(undefined);

      await build('example.com');

      expect(warn).not.toHaveBeenCalled();
    });
  });

  // `message` is request input, and the SIWE parser throws on anything it
  // cannot read. Unwrapped that surfaced as a 500 - a client typo reported as
  // a server fault, with the parser's ABNF state dump in the logs.
  describe('malformed input', () => {
    it.each([
      ['empty', ''],
      ['not a SIWE message at all', 'hello'],
      ['truncated', 'example.com wants you to sign in with your Ethereum'],
    ])('rejects a %s message as a bad request', async (_label, message) => {
      const { siwe } = await build();

      await expect(siwe.verify(WALLET, '0xsig', message)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('does not reach the cache for a message it cannot parse', async () => {
      const { siwe } = await build();
      const check = stubSignatureCheck(siwe, true);

      await siwe.verify(WALLET, '0xsig', 'garbage').catch(() => undefined);

      expect(check).not.toHaveBeenCalled();
    });
  });

  it('keeps the nonce when verification fails, so the user can retry', async () => {
    const { siwe, caching } = await build();
    stubSignatureCheck(siwe, false);
    const nonce = await siwe.getNonce(WALLET);

    await expect(
      siwe.verify(WALLET, '0xnope', messageWith(nonce)),
    ).rejects.toThrow('Invalid signature');
    await expect(caching.get<string>(NONCE_KEY)).resolves.toBe(nonce);
  });
});
