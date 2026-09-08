import { CachingError } from '../caching.interface';

describe('CachingError', () => {
  it('names the failed operation and key in its message', () => {
    const error = new CachingError('get', 'nonce:0xabc');

    expect(error.message).toBe('Caching get failed for key "nonce:0xabc"');
    expect(error.name).toBe('CachingError');
    expect(error).toBeInstanceOf(Error);
  });

  it('keeps the underlying provider error reachable as cause', () => {
    const clientError = new Error('ECONNREFUSED');
    const error = new CachingError('set', 'nonce:0xabc', clientError);

    expect(error.operation).toBe('set');
    expect(error.key).toBe('nonce:0xabc');
    expect(error.cause).toBe(clientError);
  });
});
