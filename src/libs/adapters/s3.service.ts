import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3CompatibleBase } from './s3-compatible.base';

@Injectable()
export class S3Service extends S3CompatibleBase {
  constructor(config: ConfigService) {
    super({
      bucket: config.getOrThrow<string>('storage.s3.bucket'),
      region: config.getOrThrow<string>('storage.s3.region'),
      accessKeyId: config.getOrThrow<string>('storage.s3.accessKeyId'),
      secretAccessKey: config.getOrThrow<string>('storage.s3.secretAccessKey'),
      publicBaseUrl: config.get<string>('storage.s3.publicBaseUrl'),
    });
  }
}
