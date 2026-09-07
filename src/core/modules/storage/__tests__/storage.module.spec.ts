import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { StorageModule } from '../storage.module';
import { STORAGE_ADAPTER } from '../storage.constant';
import { S3Service } from '@libs/adapters/s3.service';
import { R2Service } from '@libs/adapters/r2.service';

const storageConfig = {
  s3: {
    bucket: 'my-bucket',
    region: 'ap-southeast-1',
    accessKeyId: 'AKIAEXAMPLE',
    secretAccessKey: 'secret',
  },
  r2: {
    bucket: 'media',
    accountId: 'abc123',
    accessKeyId: 'R2KEY',
    secretAccessKey: 'secret',
  },
};

function compileWithDriver(driver: string) {
  return Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        load: [() => ({ storage: { driver, ...storageConfig } })],
      }),
      StorageModule.forRootAsync(),
    ],
  }).compile();
}

describe('StorageModule', () => {
  it('wires the S3 adapter when the driver is s3', async () => {
    const moduleRef = await compileWithDriver('s3');

    expect(moduleRef.get(STORAGE_ADAPTER)).toBeInstanceOf(S3Service);
  });

  it('wires the R2 adapter when the driver is r2 — no calling code changes', async () => {
    const moduleRef = await compileWithDriver('r2');

    expect(moduleRef.get(STORAGE_ADAPTER)).toBeInstanceOf(R2Service);
  });

  it('fails at boot when the driver is not in the registry', async () => {
    await expect(compileWithDriver('dropbox')).rejects.toThrow(
      /Unknown STORAGE_DRIVER: dropbox/,
    );
  });
});
