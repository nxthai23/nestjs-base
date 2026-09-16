# Error Code System — Design Spec

Date: 2026-09-16

## Purpose

Errors are currently identified only by HTTP status + a free-text `message`
thrown via bare NestJS exceptions (`UnauthorizedException`, `BadRequestException`,
...). A consumer (frontend, another service, a log query) has no stable
identifier to key off — it has to match on status code (too coarse: many
distinct failures share `400`/`401`) or on the message string (fragile:
changes wording, breaks i18n).

This adds a domain-prefixed **error code** (`AUTH_000`, `AUTH_001`, ...)
alongside the existing `status` + `message`, carried through a custom
exception class into the response envelope.

Confirmed with the repo owner before writing this spec:

- **Code format**: sequential numeric suffix per domain (`AUTH_000`,
  `AUTH_001`, ...), not a semantic slug (`AUTH_INVALID_SIGNATURE`).
- **Migration scope**: build the infra and migrate one module as the
  reference implementation. `auth` was picked (matches the `AUTH_000`
  example). The other four throw sites/modules (`user`, `app-config`,
  `core/base`, `core/guard`, `core/modules/mail`) keep throwing bare Nest
  exceptions for now — they still work today (no `code` in the response,
  same as now) and get migrated as follow-up work, module by module.
- **Shared/generic errors** (e.g. `BaseService`'s not-found, the RBAC
  guard's forbidden): once migrated, they get a `COMMON_xxx` code of their
  own rather than borrowing a feature domain's prefix. Not part of this
  pass — see Out of scope.
- **Code assignment is by resource, not by call site.** Revised after
  review: `AuthService`'s "User not found!" (thrown while looking a user up
  by username during login) is about the `User` entity being missing, not
  about the login *process* failing — so it's `USER_000`, not an `AUTH_xxx`
  code, even though the throw itself lives in `src/api/auth/`. The other 7
  auth codes stay `AUTH_xxx`: wrong password, and every SIWE failure, are
  about the authentication process itself (credential/signature/nonce
  checks), not a missing resource. This is the one code in this pass that
  isn't in the `auth` module's own domain — see the mapping table.

## Response shape

Error (adds `code`, omitted when the exception isn't an `AppException` —
i.e. any not-yet-migrated module keeps today's exact shape):

```json
{
  "success": false,
  "statusCode": 401,
  "code": "AUTH_000",
  "message": "Unauthorized",
  "path": "/auth/login",
  "timestamp": "2026-09-16T10:00:00.000Z"
}
```

## Components

### `src/core/exceptions/error-codes.ts` (new)

Single source of truth: one array of `{ code, status, message }` records,
grouped by domain with a comment header per group — the only place new
codes get appended. No enum, no separate lookup table to keep in sync by
hand — `ErrorCode` (the type used everywhere else) and the lookup map are
both *derived* from this one array:

```ts
export const ERROR_CODES = [
  // AUTH — src/api/auth (the authentication process itself)
  { code: 'AUTH_000', status: HttpStatus.UNAUTHORIZED, message: 'Unauthorized' },
  { code: 'AUTH_001', status: HttpStatus.UNAUTHORIZED, message: 'Wrong password!' },
  { code: 'AUTH_002', status: HttpStatus.BAD_REQUEST, message: 'Malformed SIWE message' },
  { code: 'AUTH_003', status: HttpStatus.BAD_REQUEST, message: 'Nonce is missing' },
  { code: 'AUTH_004', status: HttpStatus.BAD_REQUEST, message: 'Address mismatch' },
  { code: 'AUTH_005', status: HttpStatus.BAD_REQUEST, message: 'Invalid nonce' },
  { code: 'AUTH_006', status: HttpStatus.BAD_REQUEST, message: 'Invalid signature' },
  // USER — the User entity itself, regardless of which flow looks it up
  { code: 'USER_000', status: HttpStatus.NOT_FOUND, message: 'User not found!' },
] as const satisfies { code: string; status: HttpStatus; message: string }[];

export type ErrorCode = (typeof ERROR_CODES)[number]['code'];

const ERROR_CODE_MAP = new Map(ERROR_CODES.map((e) => [e.code, e]));

export function getErrorCode(code: ErrorCode) {
  return ERROR_CODE_MAP.get(code)!;
}
```

Every status/message here matches what the current bare exception already
throws (see mapping table below) — this pass is a like-for-like migration,
not a behavior change.

Adding a code later is a one-line append to `ERROR_CODES`; `ErrorCode`
widens automatically since it's derived, not hand-maintained. TypeScript
doesn't reject a duplicate `code` string on its own, so the module asserts
uniqueness once at import time (`if (ERROR_CODES.length !== ERROR_CODE_MAP.size) throw ...`) —
a copy-pasted entry with a stale code fails at boot, not silently at
request time. Codes are appended, never renumbered or reused — a retired
code's number stays retired so old logs/clients aren't reinterpreted as a
different error.

### `src/core/exceptions/app.exception.ts` (new)

```ts
export class AppException extends HttpException {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message?: string, status?: HttpStatus) {
    const entry = getErrorCode(code);
    super(message ?? entry.message, status ?? entry.status);
    this.code = code;
  }
}
```

Extends `HttpException` (not a parallel hierarchy) so it keeps working with
everything that already handles `HttpException` — `HttpExceptionFilter`,
Nest's default handling if the filter is ever bypassed, `instanceof`
checks elsewhere. `message`/`status` overrides exist for the rare case a
call site needs to vary the message per-call (e.g. interpolating an entity
name) while keeping the same code.

### `src/core/response/api-result.ts` (updated)

`error()` gains an optional `code` param, appended after the existing
`data` param so the one existing direct caller
(`health.controller.ts:39-44`, `ApiResult.error(msg, status, path, data)`)
doesn't need to change:

```ts
static error<T = null>(
  message: string,
  statusCode: number,
  path: string,
  data?: T,
  code?: ErrorCode,
): ApiResult<T | null>
```

`ApiResult` instances gain a `readonly code?: ErrorCode` field, serialized
only when present (`undefined` fields are dropped by `JSON.stringify`), so
a non-migrated module's error response is byte-for-byte identical to today.

### `src/core/filter/http-exception.filter.ts` (updated)

```ts
const code = exception instanceof AppException ? exception.code : undefined;
response.status(status).json(ApiResult.error(message, status, request.url, undefined, code));
```

### Auth module call sites (updated)

Each of the 8 bare-exception throws in `src/api/auth/` becomes
`throw new AppException('XXX_xxx')`, using the catalog's default
message/status (identical wording/status to today). `ErrorCode` being a
plain string-literal union means no import of an enum object is needed at
call sites — just the type, inferred from the literal. All but one land on
an `AUTH_xxx` code — `auth.service.ts:26` gets `USER_000` instead, since
it's the `User` entity that's missing, not the login process that failed
(see Purpose):

| File:line | Current | New |
|---|---|---|
| `strategies/jwt.ts:27` | `UnauthorizedException()` | `AppException('AUTH_000')` |
| `strategies/local.ts:36` | `UnauthorizedException('Wrong password!')` | `AppException('AUTH_001')` |
| `auth.service.ts:26` | `NotFoundException('User not found!')` | `AppException('USER_000')` |
| `services/siwe.service.ts:87` | `BadRequestException('Malformed SIWE message')` | `AppException('AUTH_002')` |
| `services/siwe.service.ts:93` | `BadRequestException('Nonce is missing')` | `AppException('AUTH_003')` |
| `services/siwe.service.ts:103` | `BadRequestException('Address mismatch')` | `AppException('AUTH_004')` |
| `services/siwe.service.ts:111` | `BadRequestException('Invalid nonce')` | `AppException('AUTH_005')` |
| `services/siwe.service.ts:125` | `BadRequestException('Invalid signature')` | `AppException('AUTH_006')` |

## Data flow

```
Controller/service throws AppException('AUTH_xxx')
        │
        ▼
HttpExceptionFilter — instanceof AppException → extracts .code
        │
        ▼
{ success: false, code: "AUTH_xxx", ... } JSON response

Controller/service throws a bare Nest exception (non-migrated module)
        │
        ▼
HttpExceptionFilter — not an AppException → code stays undefined
        │
        ▼
{ success: false, ... } JSON response, unchanged from today
```

## Testing

Colocated under `__tests__/`, matching existing convention:

- `src/core/exceptions/__tests__/error-codes.spec.ts` — every entry has a
  unique `code`, `getErrorCode()` returns the right record.
- `src/core/exceptions/__tests__/app.exception.spec.ts` — catalog defaults
  applied, message/status override, `instanceof HttpException`.
- `src/core/filter/__tests__/http-exception.filter.spec.ts` — extend with
  cases for `AppException` (response includes `code`) and a bare
  `HttpException` (response has no `code` key, existing assertions
  untouched).
- `src/core/response/__tests__/api-result.spec.ts` — extend `error()`
  coverage for the new `code` param.
- `src/api/auth/**/*.spec.ts` — update expected thrown-error assertions
  from `toThrow(UnauthorizedException)` etc. to check `.code` on the
  caught `AppException` where such assertions exist today.

## Docs

- `README.md` — extend the existing "**Errors:**" paragraph (line 143) with
  the `code` field and one `AppException` usage example.
- `CLAUDE.md` — add `exceptions/` to the "Cross-cutting concerns" list in
  the Architecture section.

## Out of scope (follow-up work)

- Migrating the rest of `user` (only `USER_000` exists, added because
  `auth.service.ts` needed it — the module's own throw sites, e.g.
  `user.service.ts`'s `BadRequestException('User Not Found')` and
  `InternalServerErrorException`, are untouched and should reuse/extend the
  `USER_xxx` group when they migrate), `app-config`, `core/base`
  (`BaseService`'s two not-found throws — shared by every entity, needs a
  `COMMON_xxx` code rather than a per-entity one), `core/guard`
  (`PoliciesGuard`'s forbidden), and `core/modules/mail` to `AppException`.
  Each is a small, independent follow-up once this pattern is reviewed in
  the auth module.
- Defining the `COMMON_xxx` prefix's actual codes — deferred until the
  first shared/generic call site migrates, so the codes are driven by real
  usage instead of guessed upfront.
- Swagger/OpenAPI error-response schemas — no `@ApiResponse` decorators
  exist anywhere in `src/api` today (confirmed), so adding them for just
  the error envelope would be inconsistent with the rest of the codebase.
- A lookup endpoint or static export of the catalog for frontend
  consumption — not requested; add if/when a consumer needs it.
