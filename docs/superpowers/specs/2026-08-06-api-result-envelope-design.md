# API Result Envelope — Design Spec

Date: 2026-08-06

## Purpose

All controllers in this repo currently return raw entities/arrays/void directly.
Errors go through `HttpExceptionFilter` and are shaped as
`{ statusCode, path, message }`. There is no standard success envelope, and
no pagination convention.

This adds a standard response envelope for all API responses (success and
error) so API consumers get a single, predictable shape.

## Envelope shape

Success:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Success",
  "data": {},
  "timestamp": "2026-08-06T10:00:00.000Z"
}
```

Success with pagination (`meta` present only for paginated list responses):

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Success",
  "data": [],
  "timestamp": "2026-08-06T10:00:00.000Z",
  "meta": { "page": 1, "limit": 20, "total": 143, "totalPages": 8 }
}
```

Error (mirrors the success shape):

```json
{
  "success": false,
  "statusCode": 404,
  "message": "User not found",
  "path": "/users/me",
  "timestamp": "2026-08-06T10:00:00.000Z"
}
```

## Components

### `src/core/response/api-result.ts`

- `PaginationMeta` interface: `{ page, limit, total, totalPages }`
- `Paginated<T>` interface: `{ items: T[], meta: PaginationMeta }` — the shape
  a service/controller returns when it wants an auto-paginated response
- `ApiResult<T>` class:
  - `static success<T>(data: T, message = 'Success', statusCode = HttpStatus.OK): ApiResult<T>`
  - `static paginated<T>(items: T[], meta: PaginationMeta, message = 'Success', statusCode = HttpStatus.OK): ApiResult<T[]>`
  - Instances carry `success`, `statusCode`, `message`, `data`, `timestamp`,
    and optional `meta`.
  - Named `ApiResult` (not `ApiResponse`) to avoid colliding with
    `@nestjs/swagger`'s `ApiResponse` decorator in files that use both.

### `src/core/interceptors/response.interceptor.ts`

A global `NestInterceptor<unknown, ApiResult>` registered via `APP_INTERCEPTOR`
in `app.module.ts` (same pattern already used for `APP_PIPE`). No existing
controller needs to change.

In `intercept()`, via `map()` on the return value:

1. **Already wrapped** — `value instanceof ApiResult` → passed through
   unchanged. This is how a controller sets a conditional/dynamic message,
   e.g.:
   ```ts
   return created
     ? ApiResult.success(user, 'User created', HttpStatus.CREATED)
     : ApiResult.success(user, 'User updated');
   ```
2. **Paginated shape** — `value` is a plain object matching
   `{ items: Array, meta: { page, limit, total, totalPages } }` → wrapped via
   `ApiResult.paginated(value.items, value.meta)`.
3. **Everything else** (current default: plain entity, array, primitive,
   `undefined`) → wrapped via `ApiResult.success(value)`, using the actual
   HTTP status code from `context.switchToHttp().getResponse().statusCode`
   so `@HttpCode()` overrides (e.g. `201` on create) are respected.

### `src/core/filter/http-exception.filter.ts` (updated)

Emits the mirrored error shape: adds `success: false` and `timestamp`,
keeps `statusCode`, `message`, `path`.

## Data flow

```
Controller returns T | Paginated<T> | ApiResult<T> | void
        │
        ▼
ResponseInterceptor (global, APP_INTERCEPTOR)
        │
        ▼
ApiResult<T> JSON response
```

```
Controller/service throws HttpException
        │
        ▼
HttpExceptionFilter (global, app.useGlobalFilters)
        │
        ▼
{ success: false, ... } JSON response
```

## Testing

Colocated under `__tests__/`, matching the existing convention
(`src/utils/__tests__/*.spec.ts`):

- `src/core/response/__tests__/api-result.spec.ts` — builder defaults,
  custom message/status, paginated shape, ISO timestamp format.
- `src/core/interceptors/__tests__/response.interceptor.spec.ts` — the three
  branches above, using a mocked `ExecutionContext` / `CallHandler`.
- `src/core/filter/__tests__/http-exception.filter.spec.ts` — new spec
  covering the updated error shape (no existing spec for this file today).

## Docs

- `README.md` — new subsection under "Some guide" documenting the envelope
  shape and how to use `ApiResult.success()` / `ApiResult.paginated()` for
  custom messages or explicit pagination.
- `CLAUDE.md` — add the response module + interceptor to the "Cross-cutting
  concerns" list.

## Out of scope

- No change to how services fetch/count data — pagination query params
  (page/limit parsing) are not part of this task; `Paginated<T>` is just the
  return-shape contract. Wiring actual paginated queries into `BaseService`
  is a separate follow-up.
- No Swagger `@ApiOkResponse` schema decorators for the envelope — out of
  scope for this task.
