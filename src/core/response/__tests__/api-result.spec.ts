import { HttpStatus } from '@nestjs/common';
import { ApiResult } from '../api-result';

describe('ApiResult', () => {
  describe('success', () => {
    it('wraps data with default message and status', () => {
      const result = ApiResult.success({ id: '1' });

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.message).toBe('Success');
      expect(result.data).toEqual({ id: '1' });
      expect(result.meta).toBeUndefined();
    });

    it('accepts a custom message and status code', () => {
      const result = ApiResult.success(
        { id: '1' },
        'User created',
        HttpStatus.CREATED,
      );

      expect(result.message).toBe('User created');
      expect(result.statusCode).toBe(HttpStatus.CREATED);
    });

    it('stamps an ISO-8601 timestamp', () => {
      const result = ApiResult.success(null);

      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });
  });

  describe('paginated', () => {
    it('wraps items with meta and default message/status', () => {
      const meta = { page: 1, limit: 20, total: 43, totalPages: 3 };
      const result = ApiResult.paginated([{ id: '1' }, { id: '2' }], meta);

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.message).toBe('Success');
      expect(result.data).toEqual([{ id: '1' }, { id: '2' }]);
      expect(result.meta).toEqual(meta);
    });

    it('accepts a custom message and status code', () => {
      const meta = { page: 1, limit: 20, total: 0, totalPages: 0 };
      const result = ApiResult.paginated([], meta, 'No results', HttpStatus.OK);

      expect(result.message).toBe('No results');
      expect(result.meta).toEqual(meta);
    });
  });
});
