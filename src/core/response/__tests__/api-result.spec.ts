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

  describe('error', () => {
    it('builds an error envelope with success: false', () => {
      const result = ApiResult.error(
        'User not found',
        HttpStatus.NOT_FOUND,
        '/users/me',
      );

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(HttpStatus.NOT_FOUND);
      expect(result.message).toBe('User not found');
      expect(result.path).toBe('/users/me');
      expect(result.data).toBeUndefined();
      expect(result.meta).toBeUndefined();
    });

    it('stamps an ISO-8601 timestamp', () => {
      const result = ApiResult.error('Internal server error', 500, '/users');

      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });

    it('omits data and meta from the serialized JSON output', () => {
      const result = ApiResult.error('Bad request', HttpStatus.BAD_REQUEST, '/auth/login');

      const json = JSON.parse(JSON.stringify(result));
      expect(json).toEqual({
        success: false,
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Bad request',
        path: '/auth/login',
        timestamp: result.timestamp,
      });
    });
  });

  describe('success (serialized output)', () => {
    it('omits path from the serialized JSON output', () => {
      const result = ApiResult.success({ id: '1' }, 'User created', HttpStatus.CREATED);

      const json = JSON.parse(JSON.stringify(result));
      expect(json).toEqual({
        success: true,
        statusCode: HttpStatus.CREATED,
        message: 'User created',
        data: { id: '1' },
        timestamp: result.timestamp,
      });
    });
  });
});
