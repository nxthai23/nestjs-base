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
import {
  PutObjectInput,
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
  publicBaseUrl?: string;
}

@Injectable()
export class S3Service implements StorageInterface {
  protected readonly client: S3Client;
  protected readonly bucket: string;
  private readonly region: string;
  private readonly endpoint?: string;
  protected readonly publicBaseUrl?: string;

  constructor(config: ConfigService) {
    const options = this.readOptions(config);

    this.bucket = options.bucket;
    this.region = options.region;
    this.endpoint = options.endpoint;
    this.publicBaseUrl = options.publicBaseUrl;
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
      publicBaseUrl: config.get<string>('storage.s3.publicBaseUrl'),
    };
  }

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

  getPublicUrl(key: string): string {
    const encodedKey = key.split('/').map(encodeURIComponent).join('/');
    return `${this.publicOrigin()}/${encodedKey}`;
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

  /**
   * Where publicly-readable objects are served from: a CDN or custom domain
   * when configured, otherwise the provider's own bucket host.
   */
  private publicOrigin(): string {
    if (this.publicBaseUrl) return this.publicBaseUrl.replace(/\/+$/, '');
    if (this.endpoint)
      return `${this.endpoint.replace(/\/+$/, '')}/${this.bucket}`;
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com`;
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
