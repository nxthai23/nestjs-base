# Caching Ports & Adapters (Redis / Valkey / Memcached / Memory) — Design Spec

Date: 2026-09-07
Branch: `feat/setup/code-architect`
Follows: [`2026-09-07-storage-ports-adapters-design.md`](./2026-09-07-storage-ports-adapters-design.md)

## Purpose

Put caching behind the same ports & adapters boundary already used for
storage, and collapse the three unrelated paths to Redis that exist today into
one.

The storage spec deliberately left caching alone, on the article's "rule of
two": don't build a port until a second implementation exists. A second
implementation now exists — Memcached — so the rule is satisfied and the port
is justified.

## What is there today

Three independent routes to Redis, none aware of the others:

| Path | Library | Status |
| --- | --- | --- |
| `CacheModule` in `app.module.ts` | `@nestjs/cache-manager` + `cache-manager-redis-store` | Global. One consumer: `SiweService`. |
| `core/modules/redis/redis.service.ts` | `@nestjs-modules/ioredis` | **Dead code.** `RedisModule` is commented out at `app.module.ts:69`; nothing injects `RedisService`, and injecting it today would fail DI resolution. |
| `api/health/indicators/redis.health-indicator.ts` | `ioredis`, constructed by hand | Live, but reads `redis.url` directly and opens its own connection per check. |

Configuration is split to match: `redis.url` / `redis.ttl` / `redis.type`,
where `redis.type` is read by nothing.

### A bug this design fixes

`src/api/auth/services/siwe.service.ts:33`:

```typescript
await this.cacheManager.set(walletAddress, nonce, 300); // Store nonce for 5 minutes
```

`cache-manager` v7 measures TTL in **milliseconds** — the repo's own config says
so (`ttl: 60 * 1000 // Default 1 minute in ms`). The nonce therefore lives
**300 ms**, not five minutes. `getNonce` re-issues a fresh nonce on essentially
every call, and `verify` rejects any signature that arrives more than a third of
a second after the nonce was handed out.

The port fixes this by naming the unit in the signature rather than leaving it
to a comment.

## Why these four drivers

| Driver | Wire protocol | Relationship |
| --- | --- | --- |
| `redis` | RESP | Baseline. `ioredis`. |
| `valkey` | RESP, identical | Fork of Redis 7.2. `ioredis` connects unchanged — the adapter differs only in which config keys it reads. Same relationship `R2Service` has to `S3Service`. |
| `memcached` | Memcached text/binary | Genuinely different. This is the driver that makes the port earn its keep. |
| `memory` | none | In-process `Map`. Default. |

Memcached is what forces the port to be honest:

- no sorted sets, no lists, no pipelines
- no `SCAN`, so no pattern/prefix deletion
- keys ≤ 250 bytes, values ≤ 1 MB by default
- a TTL over 30 days is interpreted as an **absolute Unix timestamp**, not a
  relative duration

So the port is the intersection of what all four can do. Anything Redis-specific
is a different concern with a different port, not a caching feature.

### Consequence: the old `RedisService` is deleted, not ported

`RedisService` exposes `zadd`, `zrange`, `zcard`, `zrem`, `zremrangebyrank` and
`pipeline`. Those are sorted-set operations — a leaderboard / sliding-window
primitive, not a cache. They cannot go in a port that Memcached implements.

Since the class is unreachable dead code today, it is removed rather than
preserved. If sorted sets are needed later they get their own port and their own
core module, and that port will legitimately have exactly one adapter.

## Concepts

| Term | Here |
| --- | --- |
| Port | `src/libs/ports/caching.interface.ts` — the contract, in domain language. |
| Adapter | `src/libs/adapters/{redis,valkey,memcached,memory}.service.ts` — one file per provider. |
| Registry | `src/libs/registry.ts` — maps a driver name to its adapter class. Gains a `caching` key. |
| Core module | `src/core/modules/caching/` — the facade feature code injects. |

## Directory layout

```
src/
├── libs/
│   ├── ports/
│   │   ├── storage.interface.ts
│   │   └── caching.interface.ts          NEW
│   ├── adapters/
│   │   ├── s3.service.ts
│   │   ├── r2.service.ts
│   │   ├── redis.service.ts              NEW
│   │   ├── valkey.service.ts             NEW  (extends RedisService)
│   │   ├── memcached.service.ts          NEW
│   │   └── memory.service.ts             NEW
│   └── registry.ts                       UPDATED
└── core/
    └── modules/
        ├── storage/
        ├── caching/                      NEW
        │   ├── caching.constant.ts
        │   ├── caching.service.ts
        │   └── caching.module.ts
        └── redis/                        DELETED
```

## The import rule

Unchanged, and already enforced. `eslint.config.js` blocks
`**/libs/adapters/*` and `@libs/adapters/*` everywhere except
`src/libs/registry.ts`, `src/libs/adapters/**`, and test files. The new adapters
are covered by the existing rule with no config change.

## The port

```typescript
// src/libs/ports/caching.interface.ts

export interface CachingInterface {
  /** Returns undefined on a miss. */
  get<T>(key: string): Promise<T | undefined>;

  /** ttlSeconds omitted → the driver's configured default. */
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;

  delete(key: string): Promise<void>;

  has(key: string): Promise<boolean>;

  /** Wipes everything the driver owns. Intended for tests. */
  clear(): Promise<void>;
}

export class CachingError extends Error {
  constructor(
    readonly operation: string,
    readonly key: string,
    readonly cause?: unknown,
  ) {
    super(`Caching ${operation} failed for key "${key}"`);
    this.name = 'CachingError';
  }
}
```

Notes on the shape:

- **TTL is seconds.** It matches `getSignedUrl(key, expiresInSeconds)` in the
  storage port, and it is the native unit of both Redis `EX` and Memcached. The
  existing `REDIS_TTL=60000` config migrates to `CACHE_TTL=60`.
- **Values are `T`, not `string`.** Every adapter JSON-serializes on write and
  parses on read, so callers see the object they stored. The memory adapter
  serializes too, so a caller cannot accidentally mutate a cached object
  in place and have that mutation appear to other readers — the memory driver
  behaves like the network ones.
- **`get` returns `undefined` on a miss**, never `null`, so `??` works and a
  stored `null` stays distinguishable from a miss.
- **No `deleteByPrefix`.** Memcached cannot do it without maintaining its own
  index. Adding it would leak provider capability into the port. When group
  invalidation is actually needed, the honest answer is a version-stamped key
  prefix, decided then.
- **`clear()` on a shared Redis is `FLUSHDB`** and wipes the whole logical
  database, not just this app's keys. It is documented as a test affordance.

## Adapters

### `memory.service.ts`

A `Map<string, { value: string; expiresAt: number }>`, lazily evicting on read.
No timers, so it cannot keep the event loop alive or leak in tests.

This is the default driver, which is the point: `CachingModule` boots with no
credentials at all. That is the problem `StorageModule` still has — it is
deliberately not registered in `app.module.ts` because its adapters call
`getOrThrow` and the local `.env` has no storage keys. `CachingModule` has no
such constraint, so it **is** registered in `app.module.ts`, and e2e tests
exercise the real thing rather than a mock.

Today's behaviour is preserved in effect but made explicit: an unconfigured app
caches in memory because `memory` is the default driver, rather than because a
factory silently detected a missing `REDIS_URL`. Choosing `redis` without a URL
is now a startup error instead of a silent downgrade.

### `redis.service.ts`

`ioredis`. Reads options through an overridable `protected readOptions(config)`
— the same seam `S3Service` exposes for `R2Service`.

- `set` → `SET key value EX ttl`
- `get` → `GET`, then `JSON.parse`
- `has` → `EXISTS`
- `clear` → `FLUSHDB`
- implements `BeforeApplicationShutdown` to `quit()` the connection

Connection options carry `maxRetriesPerRequest: 1` and a `retryStrategy` that
gives up, matching the health indicator's existing posture: a cache should fail
fast, not hold a request open.

### `valkey.service.ts`

```typescript
@Injectable()
export class ValkeyService extends RedisService {
  protected readOptions(config: ConfigService): RedisOptions {
    return {
      url: config.getOrThrow<string>('caching.valkey.url'),
      ttl: config.get<number>('caching.ttl', 60),
    };
  }
}
```

Valkey 7.2 is wire-identical to Redis, so the driver was expected to differ only
in which config keys it reads.

**It does not** — implementation turned up a real divergence. `ioredis`
recognises only `redis://` and `rediss://`. Handed any other scheme it falls
back to parsing the string as `host:port`, silently and without error:

| URL | ioredis connects to |
| --- | --- |
| `redis://valkey-primary:6379` | `valkey-primary:6379` |
| `valkey://valkey-primary:6379` | host **`valkey`**, port 6379 |
| `valkeys://cache:6380` | host **`valkeys`**, port **6379**, **TLS off** |

So `VALKEY_URL=valkeys://prod-cache:6380` would dial the wrong host
unencrypted while looking correct. `ValkeyService` therefore normalises
`valkey://` → `redis://` and `valkeys://` → `rediss://` before the client sees
the url. That quirk is exactly what an adapter is for, and it is why the file
earns its place beyond renaming config keys.

### `memcached.service.ts`

`memjs` — pure JS, no native build step, SASL support, promise API.

Divergences the adapter absorbs so they never reach the port:

- **TTL cap.** Values above `2_592_000` (30 days) are rejected with a
  `CachingError` rather than silently becoming an absolute timestamp in 1970.
- **Key length.** Keys over 250 bytes are rejected with a `CachingError` naming
  the limit, instead of failing obscurely inside the client.
- **No `EXISTS`.** `has` is a `get` with a discarded value.
- **`clear`** is `flush()`.

## Error handling: the cache fails open

This is the one place caching deliberately behaves differently from storage.

A failed upload must be reported — the caller's data did not land anywhere. A
failed cache read must not be: a cache miss is always a legal outcome, and if
Redis goes down, every request that consults the cache should get slower, not
return a 500.

So:

- **Adapters throw.** Every provider failure is wrapped in `CachingError`
  carrying `operation`, `key` and the original `cause`. Provider error shapes
  never escape `libs/adapters/`.
- **`CachingService` degrades.** It catches `CachingError`, logs it at `error`
  level with the operation and key, and returns the safe value: `undefined` for
  `get`, `false` for `has`, and a resolved promise for `set` / `delete` /
  `clear`.

This is exactly the job the facade was introduced for. In the storage design
`StorageService` was a pure delegating pass-through, justified only as "the
future home for retry and audit logging". Here it has real behaviour on day one.

The trade-off is stated plainly: a broken cache becomes invisible in the
response and visible only in logs. That is the correct default for a cache, and
the health check below is what makes the outage observable.

## Health check

`RedisHealthIndicator` is replaced by `CacheHealthIndicator`, which round-trips
a `__health__` key through `CachingService` instead of opening its own `ioredis`
connection. It works for whichever driver is configured, and it reports `up`
with the round-trip latency, or `down` with the underlying message.

To see the real failure the indicator calls the injected adapter directly rather
than going through the degrading facade — otherwise fail-open would report a
dead Redis as healthy. This is the one legitimate consumer of `CACHING_ADAPTER`
outside the module.

Two details settled while implementing:

- It reports the **root cause**, not the wrapper. `CachingError.message` reads
  "Caching set failed for key …", which is true but useless to whoever is
  reading a health check, so the indicator unwraps `cause` and reports
  `ECONNREFUSED` instead.
- A write that succeeds but does not read back is reported `down`. A cache that
  silently discards everything is not healthy.

The response also carries the `driver` that was checked. The endpoint's `redis`
key is renamed to `cache`.

## Configuration

```typescript
// src/config/configuration.ts
caching: {
  driver: process.env.CACHE_DRIVER || 'memory', // memory | redis | valkey | memcached
  ttl: parseInt(process.env.CACHE_TTL) || 60,   // seconds
  redis: {
    url: process.env.REDIS_URL,
  },
  valkey: {
    url: process.env.VALKEY_URL,
  },
  memcached: {
    servers: process.env.MEMCACHED_SERVERS, // "host:11211,host2:11211"
    username: process.env.MEMCACHED_USERNAME,
    password: process.env.MEMCACHED_PASSWORD,
  },
},
```

The old top-level `redis` block is removed. `REDIS_TTL` (ms) becomes `CACHE_TTL`
(seconds) and `REDIS_TYPE` is dropped — nothing read it. `REDIS_URL` keeps its
name so existing deployments only have to set `CACHE_DRIVER=redis`.

Redis Cluster is out of scope; `REDIS_TYPE=cluster` was never implemented.

## Wiring

Identical in shape to `StorageModule`:

```typescript
// src/libs/registry.ts
export const registry = {
  storage: { s3: S3Service, r2: R2Service },
  caching: {
    memory: MemoryService,
    redis: RedisService,
    valkey: ValkeyService,
    memcached: MemcachedService,
  },
} as const;

export type CachingDriver = keyof typeof registry.caching;
```

`CachingModule.forRootAsync()` returns a global `DynamicModule` that resolves
`caching.driver`, looks the class up in the registry, throws
`Unknown CACHE_DRIVER: ${driver}` if it is absent, and instantiates it with
`ConfigService`. It provides and exports **both** `CachingService` and the
`CACHING_ADAPTER` token — the latter solely so the health indicator can bypass
fail-open, as described above.

Unlike `StorageModule`, it is registered in `app.module.ts` immediately:

```typescript
imports: [CachingModule.forRootAsync(), ...]
```

## Data flow

```
SiweService.getNonce(address)
  └─ CachingService.get<string>(address)
       └─ CACHING_ADAPTER (whichever class the registry returned)
            └─ RedisService.get → ioredis GET → JSON.parse
                 └─ throws CachingError on failure
       └─ CachingService catches, logs, returns undefined  ← fail open
```

Feature code sees `CachingService` and `CachingInterface`. It never sees
`ioredis`, `memjs`, or `CACHING_ADAPTER`.

## Consumer migration

`SiweService` moves from `@Inject(CACHE_MANAGER) Cache` to `CachingService`:

```typescript
const existedNonce = await this.caching.get<string>(walletAddress);
if (existedNonce) return existedNonce;
const nonce = generateNonce();
await this.caching.set(walletAddress, nonce, 300); // seconds — 5 minutes
return nonce;
```

Same literal `300`, now meaning what the comment always claimed. This is the
first real consumer and the reason the port is not speculative.

Nonce keys are the raw wallet address today. That is left alone: changing the
key shape is a behaviour change unrelated to this refactor.

## Dependency changes

Removed:

- `@nestjs/cache-manager`
- `cache-manager`
- `cache-manager-redis-store`
- `@nestjs-modules/ioredis` (only the deleted `RedisService` used it)

Added:

- `memjs` + `@types/memjs`

Kept: `ioredis`, now imported from exactly one place.

## Testing

TDD, tests written before implementation, mirroring the storage suites.

| Suite | Covers |
| --- | --- |
| `libs/ports/__tests__/caching.interface.spec.ts` | `CachingError` message, name, and carried fields. |
| `libs/adapters/__tests__/memory.service.spec.ts` | Round-trip, miss, TTL expiry (fake timers), `has`, `clear`, object identity is not shared. |
| `libs/adapters/__tests__/redis.service.spec.ts` | Commands issued (`SET … EX`), JSON round-trip, `EXISTS`, failures wrapped in `CachingError`. `ioredis` prototype methods spied — no server needed. |
| `libs/adapters/__tests__/valkey.service.spec.ts` | Reads `caching.valkey.*`; inherits the Redis behaviour. |
| `libs/adapters/__tests__/memcached.service.spec.ts` | TTL cap and key-length rejection, `has` via `get`, failures wrapped. |
| `core/modules/caching/__tests__/caching.service.spec.ts` | Delegation, **and** fail-open: an adapter that throws yields `undefined` / `false` and a logged error. |
| `core/modules/caching/__tests__/caching.module.spec.ts` | Each driver name resolves to its class; unknown driver throws. |
| `api/health/__tests__/cache.health-indicator.spec.ts` | `up` with latency, `down` when the adapter throws. |

No test opens a network connection. Adapters are swapped in tests by
`overrideProvider(CACHING_ADAPTER)`, not by `vi.mock()`.

## Documentation

- `README.md` — a "Caching" section next to "File storage": choose a driver with
  `CACHE_DRIVER`, inject `CachingService`, TTL in seconds, and an explicit note
  that reads fail open.
- `CLAUDE.md` — update the ports & adapters paragraph: caching moves out of
  "deliberately still calls its library directly" into the applied list, leaving
  logging and RBAC there.
- `env.example` — the new `CACHE_*`, `VALKEY_*` and `MEMCACHED_*` keys, with
  `REDIS_TTL` / `REDIS_TYPE` removed.

## Out of scope

| Not doing | Why |
| --- | --- |
| Redis Cluster | `REDIS_TYPE` was never implemented. Add it as options on the Redis adapter when a cluster exists. |
| A sorted-set / leaderboard port | Real concern, different port. The deleted `RedisService` methods are recoverable from git history when needed. |
| `@Cacheable`-style method decorator | Needs a key-derivation convention, which is a design of its own. |
| Prefix/pattern invalidation | Memcached cannot do it. Revisit with versioned key prefixes. |
| Logging and RBAC ports | Still one implementation each. The rule of two is not met. |
| Registering `StorageModule` in `app.module.ts` | Unchanged from the storage spec: waits for the first storage consumer. |

## Implementation checklist

1. `caching.interface.ts` + its spec.
2. `memory.service.ts` — first, because everything else is verified against it.
3. `redis.service.ts`, then `valkey.service.ts`.
4. `memcached.service.ts` (+ `memjs` dependency).
5. Registry entry, `caching.constant.ts`, `caching.service.ts` (with fail-open),
   `caching.module.ts`.
6. Config + `env.example`.
7. Register `CachingModule.forRootAsync()` in `app.module.ts`; remove
   `CacheModule` and the commented-out `RedisModule`.
8. Migrate `SiweService`; fix the TTL bug.
9. Replace `RedisHealthIndicator` with `CacheHealthIndicator`.
10. Delete `src/core/modules/redis/`; drop the four retired dependencies.
11. README, CLAUDE.md.
12. `pnpm run build`, `pnpm run test`, `pnpm run test:e2e`, `pnpm run lint`.
