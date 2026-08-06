# API Result Envelope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every API response (success and error) a consistent JSON envelope, applied globally with zero changes required to existing controllers.

**Architecture:** A new `ApiResult<T>` class (with `success()`/`paginated()` static builders) is the canonical envelope. A global `ResponseInterceptor` (registered via `APP_INTERCEPTOR`) auto-wraps every controller return value into an `ApiResult`, detecting three cases: already-wrapped (pass through, for dynamic messages), paginated-shaped (`{ items, meta }`), or plain data (default wrap). The existing `HttpExceptionFilter` is updated to emit a mirrored error shape.

**Tech Stack:** NestJS 11 (`NestInterceptor`, `CallHandler`, `ExecutionContext`, `APP_INTERCEPTOR`), RxJS (`map` operator), TypeScript 6, Jest 30 + ts-jest.

## Global Constraints

- Path aliases: use `@core/*` for anything under `src/core/*` (per `tsconfig.json` and `CLAUDE.md`).
- Tests are colocated in `__tests__/` folders next to the code, named `*.spec.ts` (matches `src/utils/__tests__/decimal.helper.spec.ts`), run via `pnpm run test`.
- Envelope field order/names are fixed by the spec: `success, statusCode, message, data, timestamp, meta?`.
- Class is named `ApiResult` (not `ApiResponse`) — avoids collision with `@nestjs/swagger`'s `ApiResponse` decorator.
- Default success message is `'Success'`, default status code is `200` (`HttpStatus.OK`) unless the actual HTTP response status differs (e.g. `@HttpCode(201)`).
- No changes to any existing controller, service, or DTO — the interceptor must handle current return values (`T`, `T[]`, `void`) without modification.
- Follow existing commit convention: Conventional Commits (`feat:`, `test:`, `docs:`, etc.), one commit per task per the repo's own git history style.

---

### Task 1: `ApiResult` class and pagination types

**Files:**
- Create: `src/core/response/api-result.ts`
- Test: `src/core/response/__tests__/api-result.spec.ts`

**Interfaces:**
- Produces:
  - `interface PaginationMeta { page: number; limit: number; total: number; totalPages: number }`
  - `interface Paginated<T> { items: T[]; meta: PaginationMeta }`
  - `class ApiResult<T = unknown>` with readonly fields `success: boolean`, `statusCode: number`, `message: string`, `data: T`, `timestamp: string`, `meta?: PaginationMeta`
  - `static ApiResult.success<T>(data: T, message = 'Success', statusCode: number = HttpStatus.OK): ApiResult<T>`
  - `static ApiResult.paginated<T>(items: T[], meta: PaginationMeta, message = 'Success', statusCode: number = HttpStatus.OK): ApiResult<T[]>`

- [ ] **Step 1: Write the failing test**

Create `src/core/response/__tests__/api-result.spec.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test -- src/core/response/__tests__/api-result.spec.ts`
Expected: FAIL — `Cannot find module '../api-result'`

- [ ] **Step 3: Write minimal implementation**

Create `src/core/response/api-result.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm run test -- src/core/response/__tests__/api-result.spec.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/core/response/api-result.ts src/core/response/__tests__/api-result.spec.ts
git commit -m "feat(core): add ApiResult response envelope"
```

---

### Task 2: Global `ResponseInterceptor`

**Files:**
- Create: `src/core/interceptors/response.interceptor.ts`
- Test: `src/core/interceptors/__tests__/response.interceptor.spec.ts`

**Interfaces:**
- Consumes: `ApiResult`, `Paginated<T>`, `PaginationMeta` from `../response/api-result` (Task 1)
- Produces: `class ResponseInterceptor implements NestInterceptor<unknown, ApiResult>` with `intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResult>`

- [ ] **Step 1: Write the failing test**

Create `src/core/interceptors/__tests__/response.interceptor.spec.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test -- src/core/interceptors/__tests__/response.interceptor.spec.ts`
Expected: FAIL — `Cannot find module '../response.interceptor'`

- [ ] **Step 3: Write minimal implementation**

Create `src/core/interceptors/response.interceptor.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm run test -- src/core/interceptors/__tests__/response.interceptor.spec.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/core/interceptors/response.interceptor.ts src/core/interceptors/__tests__/response.interceptor.spec.ts
git commit -m "feat(core): add global ResponseInterceptor"
```

---

### Task 3: Register interceptor globally

**Files:**
- Modify: `src/app.module.ts:1-10` (imports), `src/app.module.ts:68-73` (providers array)

**Interfaces:**
- Consumes: `ResponseInterceptor` from `./core/interceptors/response.interceptor` (Task 2)

- [ ] **Step 1: Modify `src/app.module.ts` imports**

Add the import alongside the existing `APP_PIPE` import (`src/app.module.ts:9`):

```typescript
import { APP_PIPE, APP_INTERCEPTOR } from '@nestjs/core';
```

(replaces the existing `import { APP_PIPE } from '@nestjs/core';` line)

Add below the other core imports:

```typescript
import { ResponseInterceptor } from './core/interceptors/response.interceptor';
```

- [ ] **Step 2: Register the interceptor in the `providers` array**

Current `providers` array (`src/app.module.ts:68-73`):

```typescript
  providers: [
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
  ],
```

Replace with:

```typescript
  providers: [
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
  ],
```

- [ ] **Step 3: Verify the app still boots**

Run: `pnpm run build`
Expected: exits 0, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/app.module.ts
git commit -m "feat(core): register ResponseInterceptor globally"
```

---

### Task 4: Align `HttpExceptionFilter` error shape

**Files:**
- Modify: `src/core/filter/http-exception.filter.ts`
- Test: `src/core/filter/__tests__/http-exception.filter.spec.ts`

**Interfaces:**
- No new exports; changes the JSON body shape emitted by the existing `HttpExceptionFilter.catch()`.

- [ ] **Step 1: Write the failing test**

Create `src/core/filter/__tests__/http-exception.filter.spec.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test -- src/core/filter/__tests__/http-exception.filter.spec.ts`
Expected: FAIL — `body.success` is `undefined`, `body.timestamp` is `undefined` (current filter doesn't emit these fields)

- [ ] **Step 3: Modify `src/core/filter/http-exception.filter.ts`**

Current file:

```typescript
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { get } from 'lodash';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const message = get(
      exception.getResponse(),
      'message',
      'Internal server error',
    );

    response.status(status).json({
      statusCode: status,
      path: request.url,
      message,
    });
  }
}
```

Replace the `response.status(status).json({...})` call with:

```typescript
    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
```

(imports stay the same — no new imports needed)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm run test -- src/core/filter/__tests__/http-exception.filter.spec.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Run the full test suite to check for regressions**

Run: `pnpm run test`
Expected: all suites PASS

- [ ] **Step 6: Commit**

```bash
git add src/core/filter/http-exception.filter.ts src/core/filter/__tests__/http-exception.filter.spec.ts
git commit -m "fix(core): align HttpExceptionFilter error shape with ApiResult envelope"
```

---

### Task 5: Update `README.md` and `CLAUDE.md`

**Files:**
- Modify: `README.md:82-88` ("Some guide" section)
- Modify: `CLAUDE.md` (Architecture → Cross-cutting concerns section)

**Interfaces:**
- None — documentation only.

- [ ] **Step 1: Update `README.md`**

Current section (`README.md:82-88`):

```markdown
## Some guide

To use exception filter:

1. add @UseFilter(HttpExceptionFilter)
2. throw err (do NOT return err)
```

Replace with:

```markdown
## Some guide

To use exception filter:

1. add @UseFilter(HttpExceptionFilter)
2. throw err (do NOT return err)

### API Response envelope

Every response is automatically wrapped by the global `ResponseInterceptor`
into a consistent JSON shape — controllers don't need to do anything special,
just return data as usual:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Success",
  "data": {},
  "timestamp": "2026-08-06T10:00:00.000Z"
}
```

Errors thrown via `HttpException` (caught by `HttpExceptionFilter`) get the
mirrored shape:

```json
{
  "success": false,
  "statusCode": 404,
  "message": "User not found",
  "path": "/users/me",
  "timestamp": "2026-08-06T10:00:00.000Z"
}
```

**Custom or conditional message:** return an `ApiResult` directly from the
controller — the interceptor detects it's already wrapped and passes it
through unchanged:

```typescript
import { ApiResult } from '@core/response/api-result';

return created
  ? ApiResult.success(user, 'User created', HttpStatus.CREATED)
  : ApiResult.success(user, 'User updated');
```

**Paginated list responses:** return `{ items, meta }` (a `Paginated<T>`) and
the interceptor auto-hoists `items` into `data` and `meta` into the envelope:

```typescript
import { Paginated } from '@core/response/api-result';

async fetch(page: number, limit: number): Promise<Paginated<User>> {
  const [items, total] = await Promise.all([
    this.userService.find({}, undefined),
    this.userService.count({}),
  ]);
  return {
    items,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
```
```

- [ ] **Step 2: Update `CLAUDE.md`**

In the "Cross-cutting concerns (in `src/core/`)" bullet list, add two new
lines after the `filter/http-exception.filter.ts` line:

```markdown
- `filter/http-exception.filter.ts` — global HTTP error filter; use with `@UseFilters(HttpExceptionFilter)` and **throw** errors (don't return them). Emits `{ success: false, statusCode, message, path, timestamp }`.
- `response/api-result.ts` — `ApiResult<T>` response envelope (`success`, `statusCode`, `message`, `data`, `timestamp`, optional `meta`); use `ApiResult.success()`/`ApiResult.paginated()` when a controller needs a custom or conditional message
- `interceptors/response.interceptor.ts` — global `ResponseInterceptor` (registered via `APP_INTERCEPTOR`) that auto-wraps every controller return value into an `ApiResult`; controllers keep returning plain data/entities as before
```

(this replaces the single existing `filter/http-exception.filter.ts` line with three lines)

- [ ] **Step 3: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: document ApiResult envelope usage"
```

---

## Final verification

- [ ] Run `pnpm run test` — all suites pass
- [ ] Run `pnpm run build` — no TypeScript errors
- [ ] Run `pnpm run lint` — no lint errors
