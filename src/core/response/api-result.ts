import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../exceptions/error-codes';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}

export class ApiResult<T = unknown> {
  readonly success: boolean;
  readonly statusCode: number;
  readonly message: string;
  readonly data?: T;
  readonly path?: string;
  readonly timestamp: string;
  readonly meta?: PaginationMeta;
  readonly code?: ErrorCode;

  private constructor(partial: {
    success: boolean;
    statusCode: number;
    message: string;
    data?: T;
    path?: string;
    meta?: PaginationMeta;
    code?: ErrorCode;
  }) {
    this.success = partial.success;
    this.statusCode = partial.statusCode;
    this.message = partial.message;
    this.data = partial.data;
    this.path = partial.path;
    this.timestamp = new Date().toISOString();
    this.meta = partial.meta;
    this.code = partial.code;
  }

  static success<T>(
    data: T,
    message = 'Success',
    statusCode: number = HttpStatus.OK,
  ): ApiResult<T> {
    return new ApiResult<T>({ success: true, statusCode, message, data });
  }

  static paginated<T>(
    items: T[],
    meta: PaginationMeta,
    message = 'Success',
    statusCode: number = HttpStatus.OK,
  ): ApiResult<T[]> {
    return new ApiResult<T[]>({
      success: true,
      statusCode,
      message,
      data: items,
      meta,
    });
  }

  static error<T = null>(
    message: string,
    statusCode: number,
    path: string,
    data?: T,
    code?: ErrorCode,
  ): ApiResult<T | null> {
    return new ApiResult<T | null>({
      success: false,
      statusCode,
      message,
      path,
      data,
      code,
    });
  }
}
