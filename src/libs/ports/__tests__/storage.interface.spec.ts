import { StorageError } from '../storage.interface';

describe('StorageError', () => {
  it('names the failed operation and key in its message', () => {
    const error = new StorageError('putObject', 'avatars/user-1.png');

    expect(error.message).toBe(
      'Storage putObject failed for key "avatars/user-1.png"',
    );
    expect(error.name).toBe('StorageError');
    expect(error).toBeInstanceOf(Error);
  });

  it('keeps the underlying provider error reachable as cause', () => {
    const sdkError = new Error('NoSuchBucket');
    const error = new StorageError('deleteObject', 'tmp/a.txt', sdkError);

    expect(error.operation).toBe('deleteObject');
    expect(error.key).toBe('tmp/a.txt');
    expect(error.cause).toBe(sdkError);
  });
});
