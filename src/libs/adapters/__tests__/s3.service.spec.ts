import { Readable } from 'stream';
import { ConfigService } from '@nestjs/config';
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
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

const MB = 1024 * 1024;

/** A body large enough to cross the 5 MB part boundary, as a stream. */
function largeStream(totalMb: number): Readable {
  const chunks = Array.from({ length: totalMb }, () => Buffer.alloc(MB, 'x'));
  return Readable.from(chunks);
}

/**
 * Answers each command the multipart flow issues. Returns the spy plus the
 * commands seen, so a test can assert on the sequence.
 */
function stubMultipartFlow(failOnPart?: number) {
  const commands: unknown[] = [];
  const send = vi
    .spyOn(S3Client.prototype, 'send')
    .mockImplementation((command: unknown) => {
      commands.push(command);
      if (command instanceof CreateMultipartUploadCommand) {
        return Promise.resolve({ UploadId: 'upload-1' }) as never;
      }
      if (command instanceof UploadPartCommand) {
        const part = command.input.PartNumber;
        if (failOnPart !== undefined && part === failOnPart) {
          return Promise.reject(new Error('part rejected')) as never;
        }
        return Promise.resolve({ ETag: `"etag-${part}"` }) as never;
      }
      return Promise.resolve({}) as never;
    });

  return { send, commands };
}

function commandsOfType<T>(
  commands: unknown[],
  type: new (...a: never[]) => T,
) {
  return commands.filter((command): command is T => command instanceof type);
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

  /**
   * S3 caps a single PUT at 5 GB, and buffering a large file to send it that
   * way costs its whole size in memory. Multipart splits the body into parts
   * uploaded concurrently, so a stream is never held whole - and a part that
   * fails is retried on its own rather than restarting the upload.
   */
  describe('large bodies', () => {
    it('still sends one PutObject for a body below the part size', async () => {
      const { commands } = stubMultipartFlow();
      const s3 = new S3Service(makeConfig());

      await s3.putObject({ key: 'small.png', body: Buffer.alloc(1024) });

      expect(commandsOfType(commands, PutObjectCommand)).toHaveLength(1);
      expect(
        commandsOfType(commands, CreateMultipartUploadCommand),
      ).toHaveLength(0);
    });

    it('splits a body past the part size into a multipart upload', async () => {
      const { commands } = stubMultipartFlow();
      const s3 = new S3Service(makeConfig());

      await s3.putObject({ key: 'video.mp4', body: largeStream(12) });

      expect(
        commandsOfType(commands, CreateMultipartUploadCommand),
      ).toHaveLength(1);
      // 12 MB at the 5 MB default: 5 + 5 + 2.
      expect(commandsOfType(commands, UploadPartCommand)).toHaveLength(3);
      expect(
        commandsOfType(commands, CompleteMultipartUploadCommand),
      ).toHaveLength(1);
      expect(commandsOfType(commands, PutObjectCommand)).toHaveLength(0);
    });

    it('numbers the parts from one, in order', async () => {
      const { commands } = stubMultipartFlow();
      const s3 = new S3Service(makeConfig());

      await s3.putObject({ key: 'video.mp4', body: largeStream(12) });

      const parts = commandsOfType(commands, UploadPartCommand)
        .map((command) => command.input.PartNumber)
        .sort((a, b) => a - b);
      expect(parts).toEqual([1, 2, 3]);
    });

    it('carries the key and content type onto the multipart upload', async () => {
      const { commands } = stubMultipartFlow();
      const s3 = new S3Service(makeConfig());

      await s3.putObject({
        key: 'video.mp4',
        body: largeStream(6),
        contentType: 'video/mp4',
      });

      const [create] = commandsOfType(commands, CreateMultipartUploadCommand);
      expect(create.input).toMatchObject({
        Bucket: 'my-bucket',
        Key: 'video.mp4',
        ContentType: 'video/mp4',
      });
    });

    it('returns the key, the same as a single-part upload', async () => {
      stubMultipartFlow();
      const s3 = new S3Service(makeConfig());

      await expect(
        s3.putObject({ key: 'video.mp4', body: largeStream(6) }),
      ).resolves.toEqual({ key: 'video.mp4' });
    });

    // A failed multipart leaves its uploaded parts on the bucket, still
    // billed, until a lifecycle rule reaps them - so it has to be aborted.
    it('aborts the upload when a part fails, and reports StorageError', async () => {
      const { commands } = stubMultipartFlow(2);
      const s3 = new S3Service(makeConfig());

      const failure = await s3
        .putObject({ key: 'video.mp4', body: largeStream(12) })
        .catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(StorageError);
      expect(failure).toMatchObject({
        operation: 'putObject',
        key: 'video.mp4',
      });
      expect(
        commandsOfType(commands, AbortMultipartUploadCommand),
      ).toHaveLength(1);
      expect(
        commandsOfType(commands, CompleteMultipartUploadCommand),
      ).toHaveLength(0);
    });

    it('takes the part size from configuration', async () => {
      const { commands } = stubMultipartFlow();
      const s3 = new S3Service(makeConfig({ partSizeMb: 10 }));

      await s3.putObject({ key: 'video.mp4', body: largeStream(12) });

      // 12 MB at a 10 MB part size: 10 + 2.
      expect(commandsOfType(commands, UploadPartCommand)).toHaveLength(2);
    });

    // S3 rejects a part below 5 MB (except the last), so a smaller setting
    // would fail every upload rather than making them finer-grained.
    it('refuses to go below the 5 MB floor the protocol imposes', async () => {
      const { commands } = stubMultipartFlow();
      const s3 = new S3Service(makeConfig({ partSizeMb: 1 }));

      await s3.putObject({ key: 'video.mp4', body: largeStream(12) });

      expect(commandsOfType(commands, UploadPartCommand)).toHaveLength(3);
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
