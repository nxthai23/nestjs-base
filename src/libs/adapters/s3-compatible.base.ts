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

export interface S3CompatibleConfig {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  publicBaseUrl?: string;
}

/**
 * Shared implementation for every S3-API-compatible provider. Cloudflare R2
 * speaks the same protocol as AWS S3, so both adapters differ only in the
 * client configuration they pass here.
 */
export abstract class S3CompatibleBase implements StorageInterface {
  protected readonly client: S3Client;
  protected readonly bucket: string;
  private readonly region: string;
  private readonly endpoint?: string;
  private readonly publicBaseUrl?: string;

  protected constructor(config: S3CompatibleConfig) {
    this.bucket = config.bucket;
    this.region = config.region;
    this.endpoint = config.endpoint;
    this.publicBaseUrl = config.publicBaseUrl;
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
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
