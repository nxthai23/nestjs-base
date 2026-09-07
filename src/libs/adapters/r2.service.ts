import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Options, S3Service } from './s3.service';

/**
 * Cloudflare R2 speaks the S3 API, so it reuses the S3 implementation and
 * only points it at the account endpoint.
 */
@Injectable()
export class R2Service extends S3Service {
  protected readOptions(config: ConfigService): S3Options {
    const accountId = config.getOrThrow<string>('storage.r2.accountId');

    return {
      bucket: config.getOrThrow<string>('storage.r2.bucket'),
      accessKeyId: config.getOrThrow<string>('storage.r2.accessKeyId'),
      secretAccessKey: config.getOrThrow<string>('storage.r2.secretAccessKey'),
      publicBaseUrl: config.get<string>('storage.r2.publicBaseUrl'),
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      region: 'auto',
      forcePathStyle: true,
    };
  }

  /**
   * R2 buckets are private by default and the S3 API endpoint requires SigV4,
   * so — unlike S3 — there is no usable default public host to fall back to.
   * Public access needs a connected custom domain or the bucket's managed
   * r2.dev development URL.
   */
  getPublicUrl(key: string): string {
    if (!this.publicBaseUrl) {
      throw new Error(
        'R2 has no public bucket host: set R2_PUBLIC_BASE_URL to a connected ' +
          "custom domain or the bucket's pub-<hash>.r2.dev URL, or use " +
          'getSignedUrl() for private objects.',
      );
    }
    return super.getPublicUrl(key);
  }
}
