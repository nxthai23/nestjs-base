import {
  ArgumentsHost,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import type { Mock } from 'vitest';
import { HttpExceptionFilter } from '../http-exception.filter';
import { ApiResult } from '../../response/api-result';
import { AppException } from '../../exceptions/app.exception';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let jsonMock: Mock;
  let statusMock: Mock;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });
  });

  const buildHost = (url: string): ArgumentsHost =>
    ({
      switchToHttp: () => ({
        getResponse: () => ({ status: statusMock }),
        getRequest: () => ({ url }),
      }),
    }) as unknown as ArgumentsHost;

  it('emits the mirrored error envelope', () => {
    const exception = new HttpException('User not found', HttpStatus.NOT_FOUND);
    const host = buildHost('/users/me');

    filter.catch(exception, host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    const body = jsonMock.mock.calls[0][0];
    expect(body).toBeInstanceOf(ApiResult);
    expect(body.success).toBe(false);
    expect(body.statusCode).toBe(HttpStatus.NOT_FOUND);
    expect(body.message).toBe('User not found');
    expect(body.path).toBe('/users/me');
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it('falls back to a default message when the exception has none', () => {
    const exception = new HttpException({}, HttpStatus.INTERNAL_SERVER_ERROR);
    const host = buildHost('/users');

    filter.catch(exception, host);

    const body = jsonMock.mock.calls[0][0];
    expect(body.message).toBe('Internal server error');
  });

  it('extracts the message from an object-shaped exception response', () => {
    const exception = new NotFoundException('User not found');
    const host = buildHost('/users/me');

    filter.catch(exception, host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    const body = jsonMock.mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.statusCode).toBe(HttpStatus.NOT_FOUND);
    expect(body.message).toBe('User not found');
    expect(body.path).toBe('/users/me');
  });

  it('includes the error code for an AppException', () => {
    const exception = new AppException('AUTH_001');
    const host = buildHost('/auth/login');

    filter.catch(exception, host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    const body = jsonMock.mock.calls[0][0];
    expect(body.code).toBe('AUTH_001');
    expect(body.message).toBe('Wrong password!');
  });

  it('omits the code for a bare HttpException', () => {
    const exception = new HttpException('User not found', HttpStatus.NOT_FOUND);
    const host = buildHost('/users/me');

    filter.catch(exception, host);

    const body = jsonMock.mock.calls[0][0];
    expect(body.code).toBeUndefined();
    const json = JSON.parse(JSON.stringify(body));
    expect(json).not.toHaveProperty('code');
  });
});
