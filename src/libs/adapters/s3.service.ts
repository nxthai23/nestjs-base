import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl as presign } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import {
  PutObjectInput,
  STORAGE_DEFAULTS,
  StorageError,
  StorageInterface,
} from '@libs/ports/storage.interface';

export interface S3Options {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  /** Bytes per multipart part. Floored at 5 MB, the protocol minimum. */
  partSize?: number;
  /** Parts uploaded at once. Bounds memory at concurrency * partSize. */
  concurrency?: number;
}

/**
 * S3 rejects any part but the last below 5 MB, so a smaller setting would not
 * make uploads finer-grained - it would fail them.
 */
const MIN_PART_SIZE_BYTES = 5 * 1024 * 1024;

@Injectable()
export class S3Service implements StorageInterface {
  protected readonly client: S3Client;
  protected readonly bucket: string;
  protected readonly partSize: number;
  protected readonly concurrency: number;

  constructor(config: ConfigService) {
    const options = this.readOptions(config);

    this.bucket = options.bucket;
    this.partSize = Math.max(
      MIN_PART_SIZE_BYTES,
      options.partSize ?? STORAGE_DEFAULTS.partSizeBytes,
    );
    this.concurrency = Math.max(
      1,
      options.concurrency ?? STORAGE_DEFAULTS.uploadConcurrency,
    );
    this.client = new S3Client({
      region: options.region,
      endpoint: options.endpoint,
      forcePathStyle: options.forcePathStyle,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
    });
  }

  /** Overridden by S3-compatible providers that read different env vars. */
  protected readOptions(config: ConfigService): S3Options {
    return {
      bucket: config.getOrThrow<string>('storage.s3.bucket'),
      region: config.getOrThrow<string>('storage.s3.region'),
      accessKeyId: config.getOrThrow<string>('storage.s3.accessKeyId'),
      secretAccessKey: config.getOrThrow<string>('storage.s3.secretAccessKey'),
      partSize: mb(config.get<number>('storage.s3.partSizeMb')),
      concurrency: config.get<number>('storage.s3.uploadConcurrency'),
    };
  }

  /** One request. See the port for when to prefer this over putLargeObject. */
  async putObject(input: PutObjectInput): Promise<{ key: string }> {
    await this.execute('putObject', input.key, () =>
      this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: input.key,
          Body: input.body,
          ContentType: input.contentType,
        }),
      ),
    );
    return { key: input.key };
  }

  /**
   * Multipart, via the SDK's `Upload`: the body is chopped into `partSize`
   * chunks and `concurrency` of them travel at once, so memory stays at
   * `partSize * concurrency` whatever the file weighs.
   *
   * `leavePartsOnError` stays at its default of false, so a failure aborts the
   * upload — parts already accepted by the bucket are billed until a lifecycle
   * rule reaps them, and an abandoned upload is not something a caller can see
   * to clean up.
   */
  async putLargeObject(input: PutObjectInput): Promise<{ key: string }> {
    await this.execute('putLargeObject', input.key, () =>
      new Upload({
        client: this.client,
        partSize: this.partSize,
        queueSize: this.concurrency,
        params: {
          Bucket: this.bucket,
          Key: input.key,
          Body: input.body,
          ContentType: input.contentType,
        },
      }).done(),
    );
    return { key: input.key };
  }

  async deleteObject(key: string): Promise<void> {
    await this.execute('deleteObject', key, () =>
      this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      ),
    );
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return true;
    } catch (error) {
      if (isNotFound(error)) return false;
      throw new StorageError('exists', key, error);
    }
  }

  async getSignedUrl(key: string, expiresInSeconds = 900): Promise<string> {
    return this.execute('getSignedUrl', key, () =>
      presign(
        this.client,
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
        { expiresIn: expiresInSeconds },
      ),
    );
  }

  private async execute<T>(
    operation: string,
    key: string,
    run: () => Promise<T>,
  ): Promise<T> {
    try {
      return await run();
    } catch (error) {
      throw new StorageError(operation, key, error);
    }
  }
}

function isNotFound(error: unknown): boolean {
  const { name, $metadata } = (error ?? {}) as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    $metadata?.httpStatusCode === 404 ||
    name === 'NotFound' ||
    name === 'NoSuchKey'
  );
}

/** Config carries part size in MB; the SDK wants bytes. */
export function mb(value: number | undefined): number | undefined {
  return value === undefined ? undefined : value * 1024 * 1024;
}
