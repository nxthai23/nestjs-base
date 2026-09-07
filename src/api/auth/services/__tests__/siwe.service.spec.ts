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

  // The nonce previously used cache-manager, whose ttl is in milliseconds, so
  // `set(address, nonce, 300)` expired it after 300ms rather than 5 minutes —
  // any signature arriving later than a third of a second was rejected.
  it('keeps the nonce alive well past a second', async () => {
    vi.useFakeTimers();
    const { siwe } = await build();

    const first = await siwe.getNonce(WALLET);
    vi.advanceTimersByTime(60_000);

    await expect(siwe.getNonce(WALLET)).resolves.toBe(first);
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

  it('issues a fresh nonce once the previous one has expired', async () => {
    vi.useFakeTimers();
    const { siwe } = await build();
    const first = await siwe.getNonce(WALLET);

    vi.advanceTimersByTime(301_000);

    await expect(siwe.getNonce(WALLET)).resolves.not.toBe(first);
  });

  it('rejects a verification when no nonce was ever issued', async () => {
    const { siwe } = await build();
    const message = new SiweMessage({
      domain: 'example.com',
      address: WALLET,
      uri: 'https://example.com',
      version: '1',
      chainId: 1,
      nonce: generateNonce(),
    }).prepareMessage();

    await expect(siwe.verify(WALLET, '0xsignature', message)).rejects.toThrow(
      'Invalid nonce',
    );
  });
});
