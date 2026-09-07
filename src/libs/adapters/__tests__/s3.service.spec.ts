import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { S3Service } from '../s3.service';
import { StorageError } from '@libs/ports/storage.interface';

function makeConfig(overrides: Record<string, unknown> = {}) {
  return new ConfigService({
    storage: {
      s3: {
        bucket: 'my-bucket',
        region: 'ap-southeast-1',
        accessKeyId: 'AKIAEXAMPLE',
        secretAccessKey: 'secret',
        ...overrides,
      },
    },
  });
}

describe('S3Service', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uploads through a PutObjectCommand carrying bucket, key and content type', async () => {
    const send = vi
      .spyOn(S3Client.prototype, 'send')
      .mockResolvedValue({} as never);
    const s3 = new S3Service(makeConfig());

    const result = await s3.putObject({
      key: 'avatars/user-1.png',
      body: Buffer.from('image-bytes'),
      contentType: 'image/png',
    });

    expect(result).toEqual({ key: 'avatars/user-1.png' });

    const command = send.mock.calls[0][0] as PutObjectCommand;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: 'my-bucket',
      Key: 'avatars/user-1.png',
      ContentType: 'image/png',
    });
  });

  it('deletes through a DeleteObjectCommand carrying bucket and key', async () => {
    const send = vi
      .spyOn(S3Client.prototype, 'send')
      .mockResolvedValue({} as never);
    const s3 = new S3Service(makeConfig());

    await s3.deleteObject('tmp/report.pdf');

    const command = send.mock.calls[0][0] as DeleteObjectCommand;
    expect(command).toBeInstanceOf(DeleteObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: 'my-bucket',
      Key: 'tmp/report.pdf',
    });
  });

  it('reports an object as existing when the head request succeeds', async () => {
    const send = vi
      .spyOn(S3Client.prototype, 'send')
      .mockResolvedValue({} as never);
    const s3 = new S3Service(makeConfig());

    await expect(s3.exists('tmp/report.pdf')).resolves.toBe(true);
    expect(send.mock.calls[0][0]).toBeInstanceOf(HeadObjectCommand);
  });

  it('reports a missing object as false rather than throwing', async () => {
    const notFound = Object.assign(new Error('NotFound'), {
      name: 'NotFound',
      $metadata: { httpStatusCode: 404 },
    });
    vi.spyOn(S3Client.prototype, 'send').mockRejectedValue(notFound);
    const s3 = new S3Service(makeConfig());

    await expect(s3.exists('missing.png')).resolves.toBe(false);
  });

  it('wraps provider failures in StorageError so SDK error shapes stay contained', async () => {
    const sdkError = Object.assign(new Error('Access Denied'), {
      name: 'AccessDenied',
      $metadata: { httpStatusCode: 403 },
    });
    vi.spyOn(S3Client.prototype, 'send').mockRejectedValue(sdkError);
    const s3 = new S3Service(makeConfig());

    const failure = await s3
      .putObject({ key: 'avatars/user-1.png', body: Buffer.from('x') })
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(StorageError);
    expect(failure).toMatchObject({
      operation: 'putObject',
      key: 'avatars/user-1.png',
      cause: sdkError,
    });
  });

  it('signs a time-limited URL for private objects', async () => {
    const s3 = new S3Service(makeConfig());

    const url = await s3.getSignedUrl('private/contract.pdf', 900);

    expect(url).toContain('/private/contract.pdf');
    expect(url).toContain('X-Amz-Signature=');
    expect(url).toContain('X-Amz-Expires=900');
  });
});
