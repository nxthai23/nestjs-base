import { CallHandler, ExecutionContext, HttpStatus } from '@nestjs/common';
import { of } from 'rxjs';
import { ResponseInterceptor } from '../response.interceptor';
import { ApiResult } from '../../response/api-result';

describe('ResponseInterceptor', () => {
  let interceptor: ResponseInterceptor;

  const buildContext = (statusCode = HttpStatus.OK): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getResponse: () => ({ statusCode }),
      }),
    }) as unknown as ExecutionContext;

  const buildHandler = (value: unknown): CallHandler =>
    ({
      handle: () => of(value),
    }) as CallHandler;

  beforeEach(() => {
    interceptor = new ResponseInterceptor();
  });

  it('wraps plain data using the response status code', (done) => {
    const context = buildContext(HttpStatus.CREATED);
    const handler = buildHandler({ id: '1' });

    interceptor.intercept(context, handler).subscribe((result) => {
      expect(result).toBeInstanceOf(ApiResult);
      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(HttpStatus.CREATED);
      expect(result.message).toBe('Success');
      expect(result.data).toEqual({ id: '1' });
      expect(result.meta).toBeUndefined();
      done();
    });
  });

  it('passes an already-built ApiResult through unchanged', (done) => {
    const context = buildContext();
    const preBuilt = ApiResult.success({ id: '1' }, 'User created', 201);
    const handler = buildHandler(preBuilt);

    interceptor.intercept(context, handler).subscribe((result) => {
      expect(result).toBe(preBuilt);
      expect(result.message).toBe('User created');
      expect(result.statusCode).toBe(201);
      done();
    });
  });

  it('auto-detects a Paginated<T> shape and hoists items/meta', (done) => {
    const context = buildContext();
    const meta = { page: 1, limit: 20, total: 2, totalPages: 1 };
    const handler = buildHandler({ items: [{ id: '1' }, { id: '2' }], meta });

    interceptor.intercept(context, handler).subscribe((result) => {
      expect(result.data).toEqual([{ id: '1' }, { id: '2' }]);
      expect(result.meta).toEqual(meta);
      done();
    });
  });

  it('wraps void/undefined return values', (done) => {
    const context = buildContext(HttpStatus.NO_CONTENT);
    const handler = buildHandler(undefined);

    interceptor.intercept(context, handler).subscribe((result) => {
      expect(result.data).toBeUndefined();
      expect(result.statusCode).toBe(HttpStatus.NO_CONTENT);
      done();
    });
  });
});
