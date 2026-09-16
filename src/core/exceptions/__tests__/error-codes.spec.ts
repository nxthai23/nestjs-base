import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES, getErrorCode } from '../error-codes';

describe('error-codes', () => {
  it('has a unique code per entry', () => {
    const codes = ERROR_CODES.map((entry) => entry.code);

    expect(new Set(codes).size).toBe(codes.length);
  });

  it('looks up a known code', () => {
    expect(getErrorCode('AUTH_000')).toEqual({
      code: 'AUTH_000',
      status: HttpStatus.UNAUTHORIZED,
      message: 'Unauthorized',
    });
  });
});
