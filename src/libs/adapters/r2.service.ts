import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mb, S3Options, S3Service } from './s3.service';

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
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      region: 'auto',
      forcePathStyle: true,
      partSize: mb(config.get<number>('storage.r2.partSizeMb')),
      concurrency: config.get<number>('storage.r2.uploadConcurrency'),
    };
  }
}
