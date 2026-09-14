# BaseService Pagination — Design Spec

Date: 2026-09-14

## Revision history

1. First version added `paginate()` as a new method sitting *alongside*
   unbounded `find()`/`findAll()`. Revised same day, before merge: a sibling
   method is a foot-gun — any future `FooService extends BaseService` can
   still call the inherited `find()`/`findAll()` directly and reintroduce the
   exact unbounded-fetch bug this work exists to close, simply by not knowing
   `paginate()` is the one to use. Revision 2 merged pagination *into*
   `find()`/`findAll()` themselves, on by default, via a single options
   object carrying `page`/`limit`/`populate`/`paginate` together.
2. That single-options shape mixed two different kinds of thing into one
   object: *how to fetch* (`page`, `limit`, `populate`) and *whether to
   paginate at all* (`paginate`) — awkward to read and to reason about at a
   call site (`find({}, { paginate: false })` reads as one more pagination
   knob, not as "pagination is off"). This revision (3) splits them into two
   parameters: `options: PaginationOptions<T>` for how to fetch, and a
   trailing `paginate: boolean` for whether to. The rest of this doc
   describes this shape.

## Purpose

`BaseService.find()` / `findAll()` (`src/core/base/base.service.ts:56-66`) take
no `limit`/`offset` and call `repository.findAll({ populate })` /
`repository.find(filter, { populate })` unbounded. `UserController.fetch()`
(`GET /users`) calls `userService.findAll()` directly, so that endpoint
currently returns every user row in one query, one response. This was flagged
as a known gap when `Paginated<T>` / `ApiResult.paginated()` were added
(`2026-08-06-api-result-envelope-design.md`, "Out of scope": *"Wiring actual
paginated queries into `BaseService` is a separate follow-up"*).

The bug the user identified: pagination must happen **at the query**, not by
slicing an array after fetching everything. `ApiResult.paginated(items, meta)`
already takes pre-sliced `items` + a `meta` describing them — it is a
response-shape formatter, not where pagination logic runs, and it stays that
way. What's missing is DB-level pagination (`LIMIT`/`OFFSET` pushed into the
query) built into the methods every feature service inherits, not opt-in.

## Decision: merge into find/findAll, on by default, flag to opt out

- `find(filter, options, paginate)` / `findAll(options, paginate)` now always
  return `Paginated<T>` (`{ items, meta }`), built from a single
  `findAndCount` query. Default `page: 1`, `limit: 10`, capped at
  `limit: 100`.
- `paginate` is its own trailing parameter, not a field inside `options` —
  it answers a different question ("paginate at all?") than `options`
  ("how, if so?"), so it doesn't belong in the same bag. Defaults to `true`;
  passing `false` skips `limit`/`offset` entirely (fetch everything), and
  `meta` reports it as one page (`page: 1`, `limit: total`,
  `totalPages: total > 0 ? 1 : 0`) — so the return shape stays
  `Paginated<T>` either way, no union type.
- The escape hatch is a **code-level parameter only** — it is never wired to
  `PaginationQueryDto`/the HTTP layer, so no API client can ask for
  everything. It exists for internal callers (seeders, admin scripts,
  a genuinely small/bounded collection) that call `BaseService` methods
  directly.
- Blast radius: `find`/`findAll` have no callers left in the app today —
  `UserController.fetch()` (the only one) is updated as part of this same
  change; `app-config.service.ts` calls the repository directly, bypassing
  `BaseService`; seeders use `em.find()` directly. Zero other call sites to
  migrate, so this is effectively free to do now and much cheaper than
  discovering the foot-gun after other services depend on the old shape.

## New types (`src/core/base/base.service.interface.ts`)

Reuse `PaginationMeta`/`Paginated<T>` already defined in
`src/core/response/api-result.ts` — one pagination shape for the whole app.

```ts
export interface PaginationOptions<T> {
  populate?: Populate<T, string>;
  page?: number;
  limit?: number;
}
```

`paginate` is deliberately **not** a field here — see Decision above.
Parameter order puts `options` before `paginate`: the common call (page/limit
from a controller) never touches the flag, so it shouldn't have to pass
`undefined` to reach past it; only the rare escape-hatch call needs to name
`paginate` explicitly.

## `src/core/base/base.constant.ts`

```ts
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 100;
```

Kept out of `base.service.ts` — plain config values, not behavior.

## `BaseService.find()` / `findAll()` (`src/core/base/base.service.ts`)

```ts
import { DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } from './base.constant';

async find(
  filter: object = {},
  options?: PaginationOptions<T>,
  paginate = true,
): Promise<Paginated<T>> {
  const page = paginate ? Math.max(Number(options?.page ?? DEFAULT_PAGE), 1) : 1;
  const limit = paginate
    ? Math.min(Math.max(Number(options?.limit ?? DEFAULT_LIMIT), 1), MAX_LIMIT)
    : undefined;
  const offset = paginate ? (page - 1) * (limit as number) : undefined;

  const [items, total] = await this.repository.findAndCount(filter, {
    limit,
    offset,
    populate: options?.populate,
  });

  // meta.limit must be a number; when paginate is false, limit is
  // undefined (no cap was applied), so report the actual result size.
  const metaLimit = limit ?? total;
  return {
    items,
    meta: {
      page,
      limit: metaLimit,
      total,
      totalPages: metaLimit > 0 ? Math.ceil(total / metaLimit) : 0,
    },
  };
}

async findAll(
  options?: PaginationOptions<T>,
  paginate = true,
): Promise<Paginated<T>> {
  return this.find({}, options, paginate);
}
```

- `findAndCount` pushes `LIMIT`/`OFFSET` into a single query on both drivers
  (`EntityRepository.findAndCount` → `EntityManager.findAndCount`, confirmed
  in `@mikro-orm/core`); passing `limit`/`offset` as `undefined` (when
  `paginate` is `false`) makes MikroORM skip them, so `findAndCount` also
  serves as the "fetch everything, but still give me a count" path.
  One code path, no branching duplication.
- `page`/`limit` clamp defensively when `paginate` is on: `page` floors at 1;
  `limit` floors at 1 and caps at `MAX_LIMIT` (100).
- `Number(...)` wraps both inputs explicitly rather than relying on
  `Math.max`/`Math.min`'s implicit coercion of whatever `options.page`/
  `options.limit` actually are. This matters because `AppModule`'s global
  `ValidationPipe` is registered with no options (`useClass: ValidationPipe`,
  so `transform` defaults to `false`) — a `@Query()` DTO is validated but
  *not* transformed into real numbers before reaching the controller, so a
  querystring `?page=2` arrives as the string `"2"`.
- The standalone `paginate()` method from the first version of this spec is
  removed — `find`/`findAll` *are* the paginated methods now, there is no
  second name for the same thing.
- Escape-hatch call site (internal callers only), e.g. a seeder:
  `this.roleService.find({}, undefined, false)` — everything, still
  `Paginated<T>`.

## `IBaseService` (`src/core/base/base.service.interface.ts`)

```ts
export interface Read<T> {
  findById<IdType>(id: IdType, populate: Populate<T, string>): Promise<T | any>;
  findAll(options?: PaginationOptions<T>, paginate?: boolean): Promise<Paginated<T>>;
  find(filter: object, options?: PaginationOptions<T>, paginate?: boolean): Promise<Paginated<T>>;
  count(filter?: object): Promise<number>;
}
```

## `UserController.fetch()` (`src/api/user/user.controller.ts`)

`PaginationQueryDto` (`src/core/dto/pagination-query.dto.ts`) is unchanged —
still just `{ page?, limit? }`. It matches `PaginationOptions<T>` and is
passed as the second argument; the third (`paginate`) is never supplied from
a controller, so no API client can reach the escape hatch:

```ts
@Get()
@CheckPolicies((ability) => ability.can(Action.Read, 'all'))
async fetch(@Query() query: PaginationQueryDto) {
  const { items, meta } = await this.userService.find({}, query);
  return ApiResult.paginated(items, meta, 'Users retrieved successfully');
}
```

`GET /users` still defaults to page 1 / 10 rows and accepts `?page=&limit=`.

## Testing

- `src/core/base/__tests__/base.service.spec.ts` (rewritten): mock
  `EntityRepository.findAndCount`, assert:
  - default call → `findAndCount` called with `{ limit: 10, offset: 0, populate: undefined }`
  - `{ page: 3, limit: 20 }` → `{ limit: 20, offset: 40 }`
  - `limit` above `MAX_LIMIT` clamps to 100
  - `page: 0` / negative `page` clamps to 1
  - numeric-string `page`/`limit` (unwrapped query values) still coerce correctly
  - `paginate: false` (third argument) → `findAndCount` called with `limit: undefined, offset: undefined`; `meta` is `{ page: 1, limit: total, total, totalPages: 1 }` for a non-empty result and `totalPages: 0` for an empty one
  - `findAll(options, paginate)` delegates to `find({}, options, paginate)`
- `src/api/user/__tests__/user.controller.spec.ts`: `fetch()` calls
  `userService.find({}, query)` and wraps the result via `ApiResult.paginated`.

## Docs

- `README.md` — pagination example updated to call `find()`/`findAll()`
  directly (no separate `paginate()` name).
- `CLAUDE.md` — Repository Pattern paragraph updated: `find`/`findAll` are
  paginated by default (`page: 1`, `limit: 10`, capped at `100`), with a
  `paginate: false` code-level escape hatch, not a public API toggle.

## Out of scope

- No `orderBy` support yet — none of the current callers need sorting; add
  it if/when a real caller does (YAGNI).
- No reintroduction of the removed `ResponseInterceptor` — pagination stays
  explicit via `ApiResult.paginated()`, per
  `2026-08-06-api-result-error-and-interceptor-removal-design.md`.
- `app-config.service.ts`'s `findAllActivePublicConfigs()` stays as a direct
  repository call, unaffected — it never went through `BaseService`.
