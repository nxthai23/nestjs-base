import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode, getErrorCode } from './error-codes';

export class AppException extends HttpException {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message?: string, status?: HttpStatus) {
    const entry = getErrorCode(code);
    super(message ?? entry.message, status ?? entry.status);
    this.code = code;
  }
}
