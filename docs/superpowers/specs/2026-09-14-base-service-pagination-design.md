# BaseService Pagination — Design Spec

Date: 2026-09-14

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
way. What's missing is a `BaseService` method that asks the database for one
page (`LIMIT`/`OFFSET` pushed into the query) instead of fetching everything
and paginating in memory.

## Decision: additive, not a breaking change

Considered replacing `find`/`findAll`'s signature and return type outright vs.
adding a new method. Chose to **add `paginate()` alongside the existing
`find`/`findAll`**, which stay unbounded T[] as-is:

- `find`/`findAll` remain useful for small/bounded lookups (e.g.
  `app-config`'s active-public-configs list) and internal service-to-service
  calls that need a plain array, not a page.
- Changing their return type to `Paginated<T>` would be a breaking change for
  every current and future caller, forcing an `.items` unwrap even where
  nobody wants pagination semantics.
- Blast radius check: `UserController.fetch()` is the *only* current caller
  of `BaseService.findAll()`/`find()` in the app layer today (seeders use
  `em.find()` directly; `app-config.service.ts` calls the repository
  directly, bypassing `BaseService`) — so today nothing breaks either way,
  but additive keeps the contract stable for services written later.

## New types (`src/core/base/base.service.interface.ts`)

Reuse `PaginationMeta`/`Paginated<T>` already defined in
`src/core/response/api-result.ts` — one pagination shape for the whole app,
not a second one local to `BaseService`.

```ts
export interface PaginationParams {
  page?: number;
  limit?: number;
}
```

## `BaseService.paginate()` (`src/core/base/base.service.ts`)

```ts
protected static readonly DEFAULT_PAGE = 1;
protected static readonly DEFAULT_LIMIT = 10;
protected static readonly MAX_LIMIT = 100;

async paginate(
  filter: object = {},
  params?: PaginationParams,
  populate?: Populate<T, string>,
): Promise<Paginated<T>> {
  const page = Math.max(Number(params?.page ?? BaseService.DEFAULT_PAGE), 1);
  const limit = Math.min(
    Math.max(Number(params?.limit ?? BaseService.DEFAULT_LIMIT), 1),
    BaseService.MAX_LIMIT,
  );
  const offset = (page - 1) * limit;

  const [items, total] = await this.repository.findAndCount(filter, {
    limit,
    offset,
    populate,
  });

  return {
    items,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
```

- `findAndCount` pushes `LIMIT`/`OFFSET` into the single query on both drivers
  (`EntityRepository.findAndCount` → `EntityManager.findAndCount`, confirmed
  in `@mikro-orm/core`) — no separate `count()` round trip, no in-memory
  slicing.
- `page`/`limit` are clamped defensively: `page` floors at 1, `limit` floors
  at 1 and caps at `MAX_LIMIT` (100) so a caller can't request the whole
  table by passing `limit=999999` — that would defeat the purpose of adding
  this method.
- Defaults: `page=1`, `limit=10`, matching what was asked for.
- `Math.ceil(total / limit)` is `0` when `total` is `0` — correct, zero pages
  for zero rows.
- `Number(...)` wraps both inputs explicitly rather than relying on
  `Math.max`/`Math.min`'s implicit numeric coercion of whatever `params.page`/
  `params.limit` actually are. This matters because `AppModule`'s global
  `ValidationPipe` is registered with no options (`useClass: ValidationPipe`,
  so `transform` defaults to `false`) — a `@Query()` DTO is validated but
  *not* transformed into real numbers before reaching the controller, so a
  querystring `?page=2` arrives as the string `"2"`. `paginate()` shouldn't
  assume its caller already coerced types, since it is meant to be reused by
  any future controller.

## `IBaseService` (`src/core/base/base.service.interface.ts`)

Add to the `Read<T>` interface:

```ts
paginate(
  filter?: object,
  params?: PaginationParams,
  populate?: Populate<T, string>,
): Promise<Paginated<T>>;
```

## `UserController.fetch()` (`src/api/user/user.controller.ts`)

Add a `PaginationQueryDto` under `src/core/dto/pagination-query.dto.ts` — a
cross-cutting concern shared by any future list endpoint, so it lives beside
`core/response/api-result.ts` rather than inside one feature's `dto/` folder:

```ts
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
```

Controller change:

```ts
@Get()
@CheckPolicies((ability) => ability.can(Action.Read, 'all'))
async fetch(@Query() query: PaginationQueryDto) {
  const { items, meta } = await this.userService.paginate({}, query);
  return ApiResult.paginated(items, meta, 'Users retrieved successfully');
}
```

`GET /users` now defaults to page 1 / 10 rows and accepts `?page=&limit=`
instead of returning the whole table.

## Testing

- `src/core/base/__tests__/base.service.spec.ts` (new file — none exists
  today): mock `EntityRepository.findAndCount`, assert:
  - default params → `findAndCount` called with `{ limit: 10, offset: 0, populate: undefined }`
  - `{ page: 3, limit: 20 }` → `{ limit: 20, offset: 40 }`
  - `limit` above `MAX_LIMIT` clamps to 100
  - `page: 0` / negative `page` clamps to 1
  - `total: 0` → `meta.totalPages === 0`
  - returned shape is `{ items, meta }` built from the mocked
    `findAndCount` tuple
- `src/api/user/__tests__/user.controller.spec.ts` (new — none exists today):
  `fetch()` calls `userService.paginate({}, query)` and wraps the result via
  `ApiResult.paginated`.

## Docs

- `README.md` — pagination example: show `paginate()` + `ApiResult.paginated()`
  used together end-to-end (currently the README's pagination example, if
  any, predates this method).
- `CLAUDE.md` — note under the Repository Pattern paragraph that
  `BaseService` also exposes `paginate()` for DB-level pagination, alongside
  unbounded `find`/`findAll`.

## Out of scope

- No `orderBy` support on `paginate()` yet — none of the current callers need
  sorting; add it if/when a real caller does (YAGNI).
- No change to `find`/`findAll` signatures or behavior.
- No reintroduction of the removed `ResponseInterceptor` — pagination stays
  explicit via `ApiResult.paginated()`, per
  `2026-08-06-api-result-error-and-interceptor-removal-design.md`.
- `app-config.service.ts`'s `findAllActivePublicConfigs()` stays unbounded —
  it queries a small, operator-managed config table, not user-generated data.
