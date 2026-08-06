import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from '../http-exception.filter';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
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
});
