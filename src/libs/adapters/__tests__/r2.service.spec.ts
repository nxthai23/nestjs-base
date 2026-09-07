import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { R2Service } from '../r2.service';

function makeConfig(overrides: Record<string, unknown> = {}) {
  return new ConfigService({
    storage: {
      r2: {
        bucket: 'media',
        accountId: 'abc123',
        accessKeyId: 'R2KEY',
        secretAccessKey: 'secret',
        ...overrides,
      },
    },
  });
}

/** The SDK resolves these lazily, so reach through the adapter's client. */
function clientOf(adapter: R2Service): S3Client {
  return (adapter as unknown as { client: S3Client }).client;
}

describe('R2Service', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("points the client at the account's R2 endpoint with path-style addressing", async () => {
    const config = clientOf(new R2Service(makeConfig())).config;

    const endpoint = await config.endpoint!();
    expect(endpoint.hostname).toBe('abc123.r2.cloudflarestorage.com');
    expect(await config.region()).toBe('auto');
    expect(config.forcePathStyle).toBe(true);
  });

  it('signs URLs against the R2 endpoint, not AWS', async () => {
    const r2 = new R2Service(makeConfig());

    const url = await r2.getSignedUrl('private/contract.pdf');

    expect(url).toContain('abc123.r2.cloudflarestorage.com');
    expect(url).toContain('X-Amz-Signature=');
  });

  it('uploads through the same S3-compatible implementation as the S3 adapter', async () => {
    const send = vi
      .spyOn(S3Client.prototype, 'send')
      .mockResolvedValue({} as never);
    const r2 = new R2Service(makeConfig());

    const result = await r2.putObject({
      key: 'avatars/user-1.png',
      body: Buffer.from('image-bytes'),
      contentType: 'image/png',
    });

    expect(result).toEqual({ key: 'avatars/user-1.png' });
    const command = send.mock.calls[0][0] as PutObjectCommand;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({ Bucket: 'media' });
  });
});
