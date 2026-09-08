# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Tech Stack

NestJS 11 · MikroORM 7 · TypeScript 6 · pnpm. Supports both **MongoDB** and **PostgreSQL** (selected via `DB_TYPE` env var, default `mongodb`). Auth uses Passport JWT + local strategy with SIWE (Sign In With Ethereum) support. Caching sits behind a port with four drivers, selected by `CACHE_DRIVER` and defaulting to in-memory, so no cache server is required to run.

## Commands

```bash
# Dev (auto-reload)
pnpm run start:dev

# Build
pnpm run build

# Production
pnpm run start:prod

# Unit tests
pnpm run test
pnpm run test:cov          # with coverage

# Single test file
pnpm run test -- path/to/file.spec.ts

# E2E tests
pnpm run test:e2e

# Lint + format
pnpm run lint
pnpm run format

# Docker (includes MongoDB)
docker-compose up -d --build
```

## Architecture

**Repository Pattern**: All services extend `BaseService<T>` (`src/core/base/base.service.ts`) which provides standard CRUD (find, create, update, delete, upsert, bulkCreate) backed by MikroORM's `EntityRepository`. Entities extend `BaseEntity` (`src/core/base/base.entity.ts`) which adds `id` (string), `createdAt`, `updatedAt`.

**Module structure** — each feature in `src/api/<feature>/` contains:
- `<feature>.module.ts` — NestJS module
- `<feature>.controller.ts` — HTTP endpoints
- `<feature>.service.ts` — business logic (extends `BaseService`)
- `entities/` — MikroORM entities. Register each one in `ENTITIES`
  (`src/core/database/entities.ts`); discovery is an explicit list, not a glob,
  and `entities.spec.ts` fails if a new entity file is left out.
- `dto/` — request DTOs with class-validator decorators

**Ports & adapters**: swappable third-party dependencies go behind a port.

- `src/libs/ports/*.interface.ts` — the contract, in domain language. No SDK types.
- `src/libs/adapters/*.service.ts` — one file per provider, implements a port.
- `src/libs/registry.ts` — maps a driver name to its adapter class. **The only
  file allowed to import from `libs/adapters/`** (enforced by an ESLint
  `no-restricted-imports` rule).
- Direction of dependency: **`core` composes `libs`, never the reverse.**
  `libs/**` may not import `@core/*` (a second `no-restricted-imports` rule);
  anything both layers need — driver defaults, for instance — belongs in
  `libs/ports`.
- `src/core/modules/<concern>/` — a `<concern>.service.ts` implementing the port
  by delegating to the wired adapter, plus a `<concern>.module.ts` whose
  `forRootAsync()` resolves the driver from config. Feature code injects the
  core service, never an adapter.

Currently applied to:

- **storage** — `StorageService`, with `S3Service` / `R2Service` selected via
  `STORAGE_DRIVER`. Not yet registered in `app.module.ts`: its adapters call
  `getOrThrow` for credentials, so it waits for the first consumer. The port
  offers two uploads, `putObject` (one request) and `putLargeObject`
  (multipart, via `@aws-sdk/lib-storage`). The caller chooses by case —
  nothing switches on a size threshold, since the calling code knows what it
  is uploading and the adapter does not.
- **caching** — `CachingService`, with `MemoryService` / `RedisService` /
  `ValkeyService` / `MemcachedService` selected via `CACHE_DRIVER` (default
  `memory`). Registered globally in `app.module.ts`. TTLs are in **seconds**.
  Reads **fail open**: an unreachable cache logs an error and behaves as a
  miss rather than failing the request, so the health check is what surfaces
  an outage. The port is the intersection of all four drivers — Redis-only
  primitives (sorted sets, pipelines, `SCAN`) are a separate concern.
  The cache is one shared map, so feature code takes a namespace
  (`caching.namespace('siwe:nonce')`) rather than writing raw keys;
  `CACHE_KEY_PREFIX` sits underneath that, for a shared cache server.
  `CachingService` does not expose `clear`: the drivers implement it as a full
  flush that no prefix scopes, so it stays on the adapter for tests.

Logging and RBAC deliberately still call their libraries directly — add a port
when a second implementation actually appears, not before.

**Path aliases** (defined in `tsconfig.json`):
- `@core/*` → `src/core/*`
- `@api/*` → `src/api/*`
- `@utils/*` → `src/utils/*`
- `@config/*` → `src/config/*`
- `@libs/*` → `src/libs/*`
- `@/*` → `src/*`

**Cross-cutting concerns** (in `src/core/`):
- `filter/http-exception.filter.ts` — global HTTP error filter; use with `@UseFilters(HttpExceptionFilter)` and **throw** errors (don't return them). Builds its response via `ApiResult.error(message, statusCode, path)`, emitting `{ success: false, statusCode, message, path, timestamp }`.
- `response/api-result.ts` — `ApiResult<T>` response envelope (`success`, `statusCode`, `message`, `data`, `timestamp`, optional `meta`/`path`). Every controller builds its own envelope explicitly — there is no auto-wrapping interceptor — via `ApiResult.success(data, message?, statusCode?)`, `ApiResult.paginated(items, meta, message?, statusCode?)`, or `ApiResult.error(message, statusCode, path)`
- `middlewares/logger.middleware.ts` — request logging (applied globally)
- `decorators/current-user.decorator.ts` — `@CurrentUser()` param decorator
- `docs/swagger.ts` — Swagger UI setup (served at `/api`)
- `database/database.ts` — MikroORM config factory; handles MongoDB vs PostgreSQL switching and connection pooling
- `database/seeder/` — auto-seeds on startup when `ENABLE_SEEDER=1`

**Global pipes**: `ValidationPipe` is registered globally in `AppModule` via `APP_PIPE`.

## Environment Setup

Copy `env.example` to `.env` (or use the existing `.env`). Key variables:
- `DB_TYPE` — `mongodb` (default) or `postgresql`
- `ENABLE_SEEDER` — set to `1` to run seeders on startup
- `APP_DOMAIN` — domain a SIWE signature must be bound to. Unset disables the
  domain check (logged as a warning at startup); required before exposing SIWE
  login, since without it a signature produced on another site is accepted.
- `CACHE_DRIVER` — `memory` (default), `redis`, `valkey` or `memcached`
- `CACHE_TTL` — default cache entry lifetime, in **seconds** (default `60`)
- `CACHE_KEY_PREFIX` — prepended to every cache key; set it when the cache server is shared between apps or environments (default empty)
- `CACHE_MAX_ENTRIES` — memory driver only: entries held before the least recently used is evicted (default `10000`)
- `REDIS_URL` — required only when `CACHE_DRIVER=redis`
