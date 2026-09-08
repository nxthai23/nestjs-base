import { Test } from '@nestjs/testing';
import { StorageService } from '../storage.service';
import { STORAGE_ADAPTER } from '../storage.constant';
import { StorageInterface } from '@libs/ports/storage.interface';

function makeFakeAdapter(): StorageInterface {
  return {
    putObject: vi.fn().mockResolvedValue({ key: 'k' }),
    putLargeObject: vi.fn().mockResolvedValue({ key: 'k' }),
    deleteObject: vi.fn().mockResolvedValue(undefined),
    exists: vi.fn().mockResolvedValue(true),
    getSignedUrl: vi.fn().mockResolvedValue('https://signed.example.com/k'),
  };
}

describe('StorageService', () => {
  async function build(adapter: StorageInterface) {
    const moduleRef = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: STORAGE_ADAPTER, useValue: adapter },
      ],
    }).compile();

    return moduleRef.get(StorageService);
  }

  it('passes uploads to whichever adapter is wired in', async () => {
    const adapter = makeFakeAdapter();
    const storage = await build(adapter);
    const input = {
      key: 'k',
      body: Buffer.from('x'),
      contentType: 'text/plain',
    };

    await expect(storage.putObject(input)).resolves.toEqual({ key: 'k' });
    expect(adapter.putObject).toHaveBeenCalledWith(input);
  });

  // Two upload paths, and the facade must not quietly redirect one to the
  // other: the caller picked deliberately.
  it('passes large uploads to the adapter without rerouting them', async () => {
    const adapter = makeFakeAdapter();
    const storage = await build(adapter);
    const input = { key: 'video.mp4', body: Buffer.from('x') };

    await expect(storage.putLargeObject(input)).resolves.toEqual({ key: 'k' });
    expect(adapter.putLargeObject).toHaveBeenCalledWith(input);
    expect(adapter.putObject).not.toHaveBeenCalled();
  });

  it('keeps a plain upload on the single-request path', async () => {
    const adapter = makeFakeAdapter();
    const storage = await build(adapter);

    await storage.putObject({ key: 'a.png', body: Buffer.from('x') });

    expect(adapter.putLargeObject).not.toHaveBeenCalled();
  });

  it('passes deletes to the adapter', async () => {
    const adapter = makeFakeAdapter();
    const storage = await build(adapter);

    await storage.deleteObject('k');

    expect(adapter.deleteObject).toHaveBeenCalledWith('k');
  });

  it('passes existence checks to the adapter', async () => {
    const adapter = makeFakeAdapter();
    const storage = await build(adapter);

    await expect(storage.exists('k')).resolves.toBe(true);
    expect(adapter.exists).toHaveBeenCalledWith('k');
  });

  it('passes signed-URL generation to the adapter, forwarding the expiry', async () => {
    const adapter = makeFakeAdapter();
    const storage = await build(adapter);

    await expect(storage.getSignedUrl('k', 60)).resolves.toBe(
      'https://signed.example.com/k',
    );
    expect(adapter.getSignedUrl).toHaveBeenCalledWith('k', 60);
  });
});
