import { HttpStatus } from '@nestjs/common';

export const ERROR_CODES = [
  // AUTH — src/api/auth
  {
    code: 'AUTH_000',
    status: HttpStatus.UNAUTHORIZED,
    message: 'Unauthorized',
  },
  {
    code: 'AUTH_001',
    status: HttpStatus.UNAUTHORIZED,
    message: 'Wrong password!',
  },
  {
    code: 'AUTH_002',
    status: HttpStatus.NOT_FOUND,
    message: 'User not found!',
  },
  {
    code: 'AUTH_003',
    status: HttpStatus.BAD_REQUEST,
    message: 'Malformed SIWE message',
  },
  {
    code: 'AUTH_004',
    status: HttpStatus.BAD_REQUEST,
    message: 'Nonce is missing',
  },
  {
    code: 'AUTH_005',
    status: HttpStatus.BAD_REQUEST,
    message: 'Address mismatch',
  },
  {
    code: 'AUTH_006',
    status: HttpStatus.BAD_REQUEST,
    message: 'Invalid nonce',
  },
  {
    code: 'AUTH_007',
    status: HttpStatus.BAD_REQUEST,
    message: 'Invalid signature',
  },
] as const satisfies { code: string; status: HttpStatus; message: string }[];

export type ErrorCode = (typeof ERROR_CODES)[number]['code'];

const ERROR_CODE_MAP = new Map(ERROR_CODES.map((entry) => [entry.code, entry]));

if (ERROR_CODE_MAP.size !== ERROR_CODES.length) {
  throw new Error('Duplicate code found in ERROR_CODES');
}

export function getErrorCode(code: ErrorCode) {
  return ERROR_CODE_MAP.get(code)!;
}
