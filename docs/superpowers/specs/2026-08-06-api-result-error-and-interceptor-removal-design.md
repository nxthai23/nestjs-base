# ApiResult.error() and Interceptor Removal — Design Spec

Date: 2026-08-06

## Purpose

The previous `feat/core/api-response` work added a global `ResponseInterceptor`
so controllers wouldn't need to change to get the `ApiResult` envelope. A
follow-up task then made every controller call `ApiResult.success()`
explicitly anyway, which made the interceptor's main job (auto-wrapping raw
returns) dead code — nothing returns unwrapped data anymore, so its
`instanceof ApiResult → pass through` branch is a no-op, and its
`Paginated<T>` auto-detect / raw-data-wrap branches never fire.

Given the codebase committed to explicit wrapping, this spec:
1. Removes the now-redundant interceptor.
2. Adds an `ApiResult.error()` builder so `HttpExceptionFilter` builds its
   response the same way `ApiResult.success()`/`ApiResult.paginated()` do,
   instead of a hand-built object literal — one class defines both envelope
   shapes.

## `ApiResult` class changes

`src/core/response/api-result.ts`:

- `data` becomes optional: `readonly data?: T` (error responses don't have one)
- New optional field: `readonly path?: string` (only present on error responses)
- Constructor assigns fields in this fixed order for every instance:
  `success, statusCode, message, data, path, timestamp, meta`.
  `JSON.stringify` omits keys whose value is `undefined`, so this single
  order reproduces both previously-approved envelope shapes with no
  special-casing:
  - success: `{ success, statusCode, message, data, timestamp, meta? }`
    (`path` is `undefined` → omitted)
  - error: `{ success, statusCode, message, path, timestamp }`
    (`data` and `meta` are `undefined` → omitted)
- New builder:
  ```ts
  static error(message: string, statusCode: number, path: string): ApiResult<null>
  ```
  All three parameters required — an error response is never meaningful
  without a message, a real HTTP status, and the request path.

## `HttpExceptionFilter` changes

`src/core/filter/http-exception.filter.ts` — replaces:

```ts
response.status(status).json({
  success: false,
  statusCode: status,
  message,
  path: request.url,
  timestamp: new Date().toISOString(),
});
```

with:

```ts
response.status(status).json(ApiResult.error(message, status, request.url));
```

The message-extraction logic (string vs. object `getResponse()`, added in
the previous round) is unchanged.

## Interceptor removal

- Delete `src/core/interceptors/response.interceptor.ts` and
  `src/core/interceptors/__tests__/response.interceptor.spec.ts`.
- Remove the `APP_INTERCEPTOR`/`ResponseInterceptor` import and provider
  entry from `src/app.module.ts`, leaving the `APP_PIPE` entry untouched.

## Consequence: pagination becomes explicit

Since there's no more auto-detection of a `{ items, meta }` shape, a
controller wanting a paginated response now calls `ApiResult.paginated(items, meta)`
directly — the same explicit pattern as `.success()`/`.error()`. This only
affects documentation (no controller in the codebase currently returns
`Paginated<T>`), but the README's pagination example needs updating to
show the explicit call instead of relying on auto-wrapping.

## Docs

- `README.md` — update the "API Response envelope" section: remove
  "automatically wrapped by the global `ResponseInterceptor`" language,
  replace with "every controller method builds its own envelope via
  `ApiResult.success()` / `ApiResult.paginated()` / `ApiResult.error()`".
  Update the pagination example to explicitly `return ApiResult.paginated(items, meta)`.
  Add an error example showing `ApiResult.error()` is what `HttpExceptionFilter`
  uses internally (informational — controllers don't call it directly, only
  the filter does).
- `CLAUDE.md` — remove the `interceptors/response.interceptor.ts` bullet.
  Update the `response/api-result.ts` bullet to mention `.error()`. Update
  the `filter/http-exception.filter.ts` bullet to note it builds its
  response via `ApiResult.error()`.

## Testing

- `src/core/response/__tests__/api-result.spec.ts` — add cases for
  `ApiResult.error()`: correct `success: false`, correct `statusCode`,
  correct `message`, correct `path`, `data` and `meta` both `undefined`
  (so they don't appear in `JSON.stringify` output), ISO timestamp.
- `src/core/filter/__tests__/http-exception.filter.spec.ts` — update
  existing assertions to check the response body is built via
  `ApiResult.error()` (same field values as before; the shape doesn't
  change, only how it's constructed) — existing three test cases (string
  response, empty-object fallback, object-with-message) still apply
  unchanged in intent.
- Delete `src/core/interceptors/__tests__/response.interceptor.spec.ts`
  (the class it tests no longer exists).

## Out of scope

- No change to controller-level code (`AppConfigController`,
  `UserController`, `AuthController`) — they already call
  `ApiResult.success()` explicitly and are unaffected by this change.
- No change to `ApiResult.success()` or `ApiResult.paginated()` behavior —
  only new optional fields and the new `.error()` builder are added.
