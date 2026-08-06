import { HttpStatus } from '@nestjs/common';

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
  readonly data: T;
  readonly timestamp: string;
  readonly meta?: PaginationMeta;

  private constructor(partial: {
    success: boolean;
    statusCode: number;
    message: string;
    data: T;
    meta?: PaginationMeta;
  }) {
    this.success = partial.success;
    this.statusCode = partial.statusCode;
    this.message = partial.message;
    this.data = partial.data;
    this.timestamp = new Date().toISOString();
    this.meta = partial.meta;
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
}
