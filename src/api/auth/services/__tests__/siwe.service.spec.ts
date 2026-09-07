import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { generateNonce, SiweMessage } from 'siwe';
import { SiweService } from '../siwe.service';
import { CachingService } from '@core/modules/caching/caching.service';
import { CACHING_ADAPTER } from '@core/modules/caching/caching.constant';
import { MemoryService } from '@libs/adapters/memory.service';

const WALLET = '0x1111111111111111111111111111111111111111';

async function build() {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        load: [() => ({ caching: { ttl: 60 } })],
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

function messageWith(nonce: string): string {
  return new SiweMessage({
    domain: 'example.com',
    address: WALLET,
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
  });

  it('issues a nonce and stores it against the wallet address', async () => {
    const { siwe, caching } = await build();

    const nonce = await siwe.getNonce(WALLET);

    expect(nonce).toEqual(expect.any(String));
    await expect(caching.get<string>(WALLET)).resolves.toBe(nonce);
  });

  // A nonce is single-use. Handing back an outstanding one would keep a
  // captured signature replayable for the rest of its ttl.
  it('issues a fresh nonce on every call and stores the latest', async () => {
    const { siwe, caching } = await build();

    const first = await siwe.getNonce(WALLET);
    const second = await siwe.getNonce(WALLET);

    expect(second).not.toBe(first);
    await expect(caching.get<string>(WALLET)).resolves.toBe(second);
  });

  // The nonce previously used cache-manager, whose ttl is in milliseconds, so
  // `set(address, nonce, 300)` expired it after 300ms rather than 5 minutes —
  // any signature arriving later than a third of a second was rejected.
  it('keeps the nonce alive well past a second', async () => {
    vi.useFakeTimers();
    const { siwe, caching } = await build();

    const nonce = await siwe.getNonce(WALLET);
    vi.advanceTimersByTime(60_000);

    await expect(caching.get<string>(WALLET)).resolves.toBe(nonce);
  });

  it('holds the nonce for five minutes, then lets it lapse', async () => {
    vi.useFakeTimers();
    const { siwe, caching } = await build();
    const first = await siwe.getNonce(WALLET);

    vi.advanceTimersByTime(299_000);
    await expect(caching.get<string>(WALLET)).resolves.toBe(first);

    vi.advanceTimersByTime(2_000);
    await expect(caching.get<string>(WALLET)).resolves.toBeUndefined();
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

    await expect(caching.get<string>(WALLET)).resolves.toBeUndefined();
    await expect(siwe.verify(WALLET, '0xgood', message)).rejects.toThrow(
      'Invalid nonce',
    );
  });

  it('keeps the nonce when verification fails, so the user can retry', async () => {
    const { siwe, caching } = await build();
    stubSignatureCheck(siwe, false);
    const nonce = await siwe.getNonce(WALLET);

    await expect(
      siwe.verify(WALLET, '0xnope', messageWith(nonce)),
    ).rejects.toThrow('Invalid signature');
    await expect(caching.get<string>(WALLET)).resolves.toBe(nonce);
  });
});
