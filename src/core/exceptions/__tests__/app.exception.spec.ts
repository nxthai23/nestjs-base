import { HttpException, HttpStatus } from '@nestjs/common';
import { AppException } from '../app.exception';

describe('AppException', () => {
  it('applies the catalog default status and message', () => {
    const exception = new AppException('AUTH_001');

    expect(exception).toBeInstanceOf(HttpException);
    expect(exception.code).toBe('AUTH_001');
    expect(exception.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    expect(exception.message).toBe('Wrong password!');
  });

  it('lets the message be overridden while keeping the catalog status', () => {
    const exception = new AppException('USER_000', 'Custom message');

    expect(exception.code).toBe('USER_000');
    expect(exception.message).toBe('Custom message');
    expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
  });

  it('lets the status be overridden too', () => {
    const exception = new AppException(
      'AUTH_000',
      undefined,
      HttpStatus.FORBIDDEN,
    );

    expect(exception.getStatus()).toBe(HttpStatus.FORBIDDEN);
    expect(exception.message).toBe('Unauthorized');
  });
});
