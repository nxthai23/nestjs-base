# Storage via Ports & Adapters — Design Spec

Date: 2026-09-07

## Purpose

This repo has no file-storage capability at all, and two providers are wanted
(AWS S3 and Cloudflare R2). Rather than importing an SDK directly into feature
code — the way `ioredis` is imported directly in
`src/core/modules/redis/redis.service.ts` and `@casl/ability` in
`src/core/casl/casl-ability.factory.ts` — storage is introduced behind a
**port/adapter** boundary.

This spec does two things:

1. Establishes the repo-wide **ports & adapters convention** (folder layout,
   naming, wiring, import rule) that any future swappable dependency follows.
2. Applies it to the first real case: a `StorageInterface` port with `S3Service`
   and `R2Service` adapters.

Reference for the pattern:
<https://saadh393.github.io/blog/adapter-port-architecture-two-cases>

### Why storage first

The pattern's own guidance is the **rule of two**: build a port when there are
two implementations, or a real conversation about a second one. Storage
qualifies today (S3 + R2). Logging, caching and RBAC each have exactly one
implementation and no planned second, so they are explicitly **not** migrated
here — see [Out of scope](#out-of-scope).

## Concepts

| Piece        | Lives in                    | Job                                                       |
| ------------ | --------------------------- | --------------------------------------------------------- |
| **Port**     | `src/libs/ports/`           | An interface in our own domain language. No SDK types.     |
| **Adapter**  | `src/libs/adapters/`        | Wraps exactly one provider. Implements a port.             |
| **Registry** | `src/libs/registry.ts`      | Maps a driver name to its adapter class. The only wiring.  |
| **Module**   | `src/core/modules/<name>/`  | NestJS service + module that expose the port to the app.   |

## Directory layout

```
src/libs/
  ports/
    storage.interface.ts        # StorageInterface, PutObjectInput, StorageError
  adapters/
    s3.service.ts               # S3Service — holds the AWS SDK v3 calls
    r2.service.ts               # R2Service extends S3Service (endpoint only)
    __tests__/
      s3.service.spec.ts
      r2.service.spec.ts
  registry.ts                   # { storage: { s3: S3Service, r2: R2Service } }

src/core/modules/storage/
  storage.constant.ts           # STORAGE_ADAPTER injection token
  storage.service.ts            # StorageService implements StorageInterface
  storage.module.ts             # StorageModule.forRootAsync()
  __tests__/
    storage.service.spec.ts
```

`core/modules/<concern>/` keeps the per-concern subfolder shape already used by
`core/modules/redis/` and `core/modules/logger/`.

## The import rule

> `src/api/**` and `src/core/**` may import from `libs/ports/`.
> They may **never** import from `libs/adapters/`.
> `libs/registry.ts` is the only file allowed to import adapters.

This single rule is what makes a provider swap a config change instead of a
code change. It is enforced mechanically with an ESLint
`no-restricted-imports` rule (see [Lint enforcement](#lint-enforcement)).

## Components

### `src/libs/ports/storage.interface.ts`

The contract, in our words. Contains no `S3Client`, no `PutObjectCommand`, no
`Bucket` — nothing that names a provider.

```ts
import { Readable } from 'stream';

export interface PutObjectInput {
  key: string;
  body: Buffer | Readable;
  contentType?: string;
}

export interface StorageInterface {
  putObject(input: PutObjectInput): Promise<{ key: string }>;
  deleteObject(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getPublicUrl(key: string): string;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
}

export class StorageError extends Error {
  constructor(
    readonly operation: string,
    readonly key: string,
    readonly cause?: unknown,
  ) {
    super(`Storage ${operation} failed for key "${key}"`);
    this.name = 'StorageError';
  }
}
```

Method set is deliberately minimal — upload, delete, existence check, and URL
generation. Reading bytes back (`getObject`) and prefix listing
(`listObjects`) are not included; neither has a caller yet, and both can be
added to the port later when one appears.

### `src/libs/adapters/s3.service.ts`

`S3Service` holds every `@aws-sdk/client-s3` call and implements
`StorageInterface` directly. Its constructor builds the client from options
returned by an overridable `readOptions(config)`:

```ts
export interface S3Options {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;       // R2 sets this; plain S3 leaves it undefined
  forcePathStyle?: boolean;
  publicBaseUrl?: string;  // CDN / public bucket origin for getPublicUrl
}

@Injectable()
export class S3Service implements StorageInterface {
  constructor(config: ConfigService) { /* builds S3Client from readOptions */ }

  /** Overridden by S3-compatible providers that read different env vars. */
  protected readOptions(config: ConfigService): S3Options { /* storage.s3.* */ }
}
```

It reads `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
and optional `S3_PUBLIC_BASE_URL`, with no custom endpoint.

Every SDK call is wrapped in try/catch and rethrown as `StorageError` so that
provider-specific error shapes (`S3ServiceException`, R2 quirks) never reach
callers. `exists()` is the one exception: a `NotFound` / `404` is a normal
`false` return, not an error.

Required config is read with `getOrThrow`, so a misconfigured deployment fails
at application boot rather than on the first upload.

### `src/libs/adapters/r2.service.ts`

Cloudflare R2 implements the S3 API, so `R2Service extends S3Service` and
overrides only `readOptions` — reading `R2_BUCKET`, `R2_ACCOUNT_ID`,
`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and optional `R2_PUBLIC_BASE_URL`,
and setting `endpoint: https://<account_id>.r2.cloudflarestorage.com`,
`region: 'auto'`, `forcePathStyle: true`.

An earlier draft of this spec put the shared implementation in a third
`s3-compatible.base.ts` abstract class with two thin subclasses. That was
dropped: it split one implementation across three files, two of which contained
no behaviour at all. A provider that is *not* S3-compatible (local disk, GCS,
Azure Blob) implements `StorageInterface` directly as its own sibling adapter
and inherits nothing from `S3Service`.

`getPublicUrl(key)` returns `<publicBaseUrl>/<key>` when `*_PUBLIC_BASE_URL` is
configured (the normal case — a CDN or custom domain in front of the bucket).
When it is not configured it falls back to the provider's default object URL:
`https://<bucket>.s3.<region>.amazonaws.com/<key>` for S3, and the account
endpoint form for R2. Objects still have to be publicly readable for that URL
to resolve — for private buckets, callers use `getSignedUrl` instead.

### `src/libs/registry.ts`

The one file that knows which adapters exist. Adding a third provider is a new
service file plus one line here.

```ts
import { S3Service } from './adapters/s3.service';
import { R2Service } from './adapters/r2.service';

export const registry = {
  storage: {
    s3: S3Service,
    r2: R2Service,
  },
} as const;

export type StorageDriver = keyof typeof registry.storage;
```

It exports classes, not instances — instantiation stays with the NestJS DI
factory so adapters still receive `ConfigService`.

### `src/core/modules/storage/storage.constant.ts`

```ts
export const STORAGE_ADAPTER = Symbol('STORAGE_ADAPTER');
```

Kept in its own file so `storage.service.ts` and `storage.module.ts` can both
import it without a circular dependency.

### `src/core/modules/storage/storage.module.ts`

The NestJS equivalent of the article's `registry.ts` switch: resolve the driver
from config at boot, look the class up in the registry, bind the instance to
`STORAGE_ADAPTER`.

```ts
@Module({})
export class StorageModule {
  static forRootAsync(): DynamicModule {
    return {
      module: StorageModule,
      global: true,
      imports: [ConfigModule],
      providers: [
        {
          provide: STORAGE_ADAPTER,
          inject: [ConfigService],
          useFactory: (config: ConfigService): StorageInterface => {
            const driver = config.getOrThrow<StorageDriver>('storage.driver');
            const Adapter = registry.storage[driver];
            if (!Adapter) {
              throw new Error(`Unknown STORAGE_DRIVER: ${driver}`);
            }
            return new Adapter(config);
          },
        },
        StorageService,
      ],
      exports: [StorageService],
    };
  }
}
```

The module is `global: true` — matching how
`CacheModule.registerAsync({ isGlobal: true })` is already registered — so one
import anywhere exposes `StorageService` app-wide.

It is deliberately **not** imported in `app.module.ts` yet. Adapters read their
credentials with `getOrThrow` at construction, so registering the module before
any feature needs storage would make S3/R2 credentials mandatory for every
`pnpm start:dev` and for the e2e suite, which boots `AppModule`. Since this
change ships no consumer (see [Out of scope](#out-of-scope)), registration
belongs to the first feature that actually uploads something:

```ts
// app.module.ts — add when the first storage consumer lands
StorageModule.forRootAsync(),
```

An unset `STORAGE_DRIVER` falls back to `s3` (the `configuration.ts` default);
a driver name that is not in the registry throws at application boot rather
than on first upload.

### `src/core/modules/storage/storage.service.ts`

The facade feature code actually injects. It implements the same port and
delegates to whichever adapter was wired.

```ts
@Injectable()
export class StorageService implements StorageInterface {
  constructor(
    @Inject(STORAGE_ADAPTER) private readonly adapter: StorageInterface,
  ) {}

  putObject(input: PutObjectInput) { return this.adapter.putObject(input); }
  deleteObject(key: string) { return this.adapter.deleteObject(key); }
  exists(key: string) { return this.adapter.exists(key); }
  getPublicUrl(key: string) { return this.adapter.getPublicUrl(key); }
  getSignedUrl(key: string, ttl?: number) {
    return this.adapter.getSignedUrl(key, ttl);
  }
}
```

Consumers write `constructor(private storage: StorageService) {}` — ordinary
NestJS injection, no token ceremony at call sites.

The pass-through looks redundant today, and that is intentional: it is the
single place where behaviour that must apply to *every* provider goes later
(retry/backoff, audit logging, key prefixing per environment). The article
calls this out as the larger payoff of the pattern — once there is one place to
do those things, doing them consistently is free.

## Configuration

`src/config/configuration.ts` gains a `storage` section:

```ts
storage: {
  driver: process.env.STORAGE_DRIVER || 's3',
  s3: {
    bucket: process.env.S3_BUCKET,
    region: process.env.S3_REGION,
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL,
  },
  r2: {
    bucket: process.env.R2_BUCKET,
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    publicBaseUrl: process.env.R2_PUBLIC_BASE_URL,
  },
},
```

Added to `env.example`:

```
# storage settings
STORAGE_DRIVER=s3          # s3 | r2

S3_BUCKET=xxx
S3_REGION=ap-southeast-1
S3_ACCESS_KEY_ID=xxx
S3_SECRET_ACCESS_KEY=xxx
S3_PUBLIC_BASE_URL=

R2_BUCKET=xxx
R2_ACCOUNT_ID=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_PUBLIC_BASE_URL=
```

### New dependencies

- `@aws-sdk/client-s3`
- `@aws-sdk/s3-request-presigner`

Both are used by S3 and R2 alike.

## Data flow

```
src/api/**/*.service.ts
        │  injects StorageService
        ▼
StorageService  (src/core/modules/storage)      implements StorageInterface
        │  delegates to STORAGE_ADAPTER
        ▼
S3Service | R2Service  (src/libs/adapters)      implements StorageInterface
        │  @aws-sdk/client-s3
        ▼
AWS S3  |  Cloudflare R2
```

Adapter selection happens once, at boot:

```
STORAGE_DRIVER=r2
        │
        ▼
StorageModule.forRootAsync() → registry.storage['r2'] → new R2Service(config)
        │
        ▼
bound to STORAGE_ADAPTER for the process lifetime
```

Switching providers is a one-line `.env` change. No file under `src/api/` or
`src/core/` is touched.

## Error handling

All adapter failures surface as `StorageError`, carrying `operation`, `key`,
and the original `cause`. Callers never catch AWS SDK error classes.

`StorageError` is *not* an `HttpException`, so it does not carry an HTTP status
of its own — feature code decides what a storage failure means for its endpoint
and throws the appropriate `HttpException`, which `HttpExceptionFilter` then
renders through `ApiResult.error(...)` as usual.

## Testing

Colocated `__tests__/` directories, matching the existing convention.

- `src/libs/adapters/__tests__/s3.service.spec.ts` and `r2.service.spec.ts` —
  mock `S3Client.prototype.send`, assert the correct command type and input
  (bucket, key, content type) is dispatched, that SDK rejections become
  `StorageError`, and that `exists()` maps a `NotFound` to `false` rather than
  throwing. R2's spec additionally asserts the endpoint / `region: 'auto'` /
  `forcePathStyle` client configuration.
- `src/core/modules/storage/__tests__/storage.service.spec.ts` — builds a
  testing module with `overrideProvider(STORAGE_ADAPTER)` supplying a plain
  fake object that implements `StorageInterface`, and asserts each method
  delegates. No `vi.mock()` and no module patching needed — swapping the
  implementation *is* the pattern.

No test performs a live S3 or R2 call.

## Lint enforcement

An ESLint `no-restricted-imports` rule fails the build when anything outside
`src/libs/registry.ts` imports from `src/libs/adapters/`:

```
'@typescript-eslint/no-restricted-imports': ['error', {
  patterns: [{
    group: ['**/libs/adapters/*', '@libs/adapters/*'],
    message: 'Import the port from libs/ports and inject the core service. Only libs/registry.ts may import adapters.',
  }],
}]
```

with an override lifting the rule for `src/libs/registry.ts` itself.

## Documentation

- `CLAUDE.md` — add a "Ports & adapters" subsection under Architecture
  describing the three folders, the naming convention
  (`*.interface.ts` in ports, `*.service.ts` in adapters), and the import rule.
- `README.md` — a short "File storage" section: the env vars, how to switch
  driver, and a copy-paste example of injecting `StorageService`.

## Out of scope

- **No HTTP surface.** No controller, no upload endpoint, no multipart
  handling. This ships the port, the adapters and the wiring only; the first
  feature that needs uploads adds its own endpoint and injects
  `StorageService`.
- **No presigned upload URLs.** Only server-side uploads are supported
  (`putObject`). `getSignedUploadUrl` can be added to the port later if
  direct-to-bucket client uploads are needed; it would also require bucket CORS
  configuration.
- **No `getObject` / `listObjects`.** Added when a caller needs them.
- **No migration of logging, caching, or RBAC.** Each currently has one
  implementation and no planned second, so a port for them today would be
  speculative abstraction — cost paid on every read, benefit never collected.
  When a second implementation appears, the migration follows this same shape:

  | Concern | Port (`libs/ports/`) | Adapters (`libs/adapters/`)      | Module (`core/modules/`)         |
  | ------- | -------------------- | -------------------------------- | -------------------------------- |
  | Caching | `caching.interface.ts` | `redis.service.ts` (moved from `core/modules/redis/`), `memory.service.ts` | `caching/caching.service.ts` + `caching.module.ts` |
  | Logging | `logging.interface.ts` | `pino.service.ts`               | `logging/logging.service.ts` + `logging.module.ts` |
  | RBAC    | `rbac.interface.ts`    | `casl.service.ts`               | `rbac/rbac.service.ts` + `rbac.module.ts` |

  Migrating one of these is its own spec and its own PR, done incrementally —
  port and adapter for the *existing* provider first, call sites moved over one
  at a time, second adapter last.

## Implementation checklist

1. Add `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`.
2. `src/libs/ports/storage.interface.ts`.
3. `src/libs/adapters/s3.service.ts`, `src/libs/adapters/r2.service.ts`.
4. `src/libs/registry.ts`.
5. `src/core/modules/storage/` — constant, service, module.
6. `configuration.ts` + `env.example`.
7. Adapter, service and module specs.
8. ESLint restricted-import rule.
9. `CLAUDE.md` + `README.md`.
