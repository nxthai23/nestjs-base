import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3CompatibleBase } from './s3-compatible.base';

@Injectable()
export class R2Service extends S3CompatibleBase {
  constructor(config: ConfigService) {
    const accountId = config.getOrThrow<string>('storage.r2.accountId');

    super({
      bucket: config.getOrThrow<string>('storage.r2.bucket'),
      accessKeyId: config.getOrThrow<string>('storage.r2.accessKeyId'),
      secretAccessKey: config.getOrThrow<string>('storage.r2.secretAccessKey'),
      publicBaseUrl: config.get<string>('storage.r2.publicBaseUrl'),
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      region: 'auto',
      forcePathStyle: true,
    });
  }
}
