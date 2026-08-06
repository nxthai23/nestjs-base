import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResult, Paginated } from '../response/api-result';

function isPaginated(value: unknown): value is Paginated<unknown> {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<Paginated<unknown>>;
  return (
    Array.isArray(candidate.items) &&
    typeof candidate.meta === 'object' &&
    candidate.meta !== null &&
    typeof (candidate.meta as any).page === 'number' &&
    typeof (candidate.meta as any).limit === 'number' &&
    typeof (candidate.meta as any).total === 'number' &&
    typeof (candidate.meta as any).totalPages === 'number'
  );
}

@Injectable()
export class ResponseInterceptor
  implements NestInterceptor<unknown, ApiResult>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResult> {
    const statusCode = context.switchToHttp().getResponse().statusCode;

    return next.handle().pipe(
      map((value) => {
        if (value instanceof ApiResult) {
          return value;
        }

        if (isPaginated(value)) {
          return ApiResult.paginated(value.items, value.meta);
        }

        return ApiResult.success(value, 'Success', statusCode);
      }),
    );
  }
}
