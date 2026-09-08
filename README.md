## Description

[Nest](https://github.com/nxthai23/nestjs-base) Base nestjs project struct using Repository Pattern

## Installation

```bash
$ npm ci
```

## Running the app

### Step 1:

Setting up your env in env.example file

### Step 2:

Choose command below and run

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Running the app Docker way

### Requirements:

- Docker
- Docker compose

Step 1:

Run the command below:

```bash
$ docker-compose up -d --build
```

## Project Structure

Base on Repository Pattern <br>
Updating...

## Terraform Guide

1. Go to terraform folder with your envs, run

```bash
terraform init
```

2. Run terraform plan to check create infra is right

```bash
terraform plan -var-file="{{env}}.tfvars"
```

3. Run validate and format

```bash
terraform validate
```

```bash
terraform fmt
```

4. Create infra via Terraform

```bash
terraform apply -var-file="{{env}}.tfvars"
```

## Some guide

To use exception filter:

1. add @UseFilter(HttpExceptionFilter)
2. throw err (do NOT return err)

### API Response envelope

Every controller builds its own `ApiResult` envelope explicitly — there is no
interceptor auto-wrapping responses. Call `ApiResult.success()` (or
`.paginated()`) and return the result:

```typescript
import { ApiResult } from '@core/response/api-result';

@Get('/me')
async findOne(@Req() req: Request) {
  const user = await this.userService.findById(req['userId']);
  return ApiResult.success(user, 'User retrieved successfully');
}
```

which produces:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "User retrieved successfully",
  "data": {},
  "timestamp": "2026-08-06T10:00:00.000Z"
}
```

**Custom status code** (e.g. `201` on create): pass it as the third argument —
`ApiResult.success(user, 'User created', HttpStatus.CREATED)`.

**Paginated list responses:** call `ApiResult.paginated(items, meta)`:

```typescript
import { ApiResult } from '@core/response/api-result';

async fetch(page: number, limit: number) {
  const [items, total] = await Promise.all([
    this.userService.find({}, undefined),
    this.userService.count({}),
  ]);
  const meta = { page, limit, total, totalPages: Math.ceil(total / limit) };
  return ApiResult.paginated(items, meta);
}
```

**Errors:** `HttpExceptionFilter` builds its response the same way, via
`ApiResult.error(message, statusCode, path)` — you don't call this directly,
just `@UseFilters(HttpExceptionFilter)` and throw:

```json
{
  "success": false,
  "statusCode": 404,
  "message": "User not found",
  "path": "/users/me",
  "timestamp": "2026-08-06T10:00:00.000Z"
}
```

### File storage (S3 / R2)

Storage follows the ports & adapters layout: the contract lives in
`src/libs/ports/storage.interface.ts`, the providers in `src/libs/adapters/`
(`s3.service.ts`, `r2.service.ts`), and `src/libs/registry.ts` maps a driver
name to its adapter.

Pick a provider with one env var — no code changes:

```
STORAGE_DRIVER=s3          # or r2
```

then fill in the matching `S3_*` / `R2_*` values from `env.example`.

Register the module once (it is global), then inject `StorageService`:

```typescript
// app.module.ts
imports: [StorageModule.forRootAsync()],
```

**The flow: store the key, not the URL.** Upload returns the object key, which
is what goes in the database; links are generated on read and expire.

```typescript
import { StorageService } from '@core/modules/storage/storage.service';

@Injectable()
export class AvatarService {
  constructor(private readonly storage: StorageService) {}

  async upload(userId: string, file: Express.Multer.File) {
    const { key } = await this.storage.putObject({
      key: `avatars/${userId}.png`,
      body: file.buffer,
      contentType: file.mimetype,
    });
    await this.userService.update(userId, { avatarKey: key });
    return key;
  }

  async getAvatarUrl(user: User) {
    // presigned, valid 15 minutes by default
    return this.storage.getSignedUrl(user.avatarKey);
  }
}
```

Keys are chosen by the caller, so re-uploading the same key overwrites in place
instead of leaving orphaned objects. URLs are never persisted: they are signed
per request, so they keep working after a bucket, domain or provider change.

Use `getSignedUrl(key, expiresInSeconds)` for private objects. Adapter failures
arrive as `StorageError` (carrying `operation`, `key` and the original `cause`),
so provider-specific error shapes never leak into feature code.

> Feature code must never import from `src/libs/adapters/` — depend on the port
> and inject `StorageService`. An ESLint rule enforces this.

### Caching (Memory / Redis / Valkey / Memcached)

Same layout: the contract is in `src/libs/ports/caching.interface.ts`, the
providers in `src/libs/adapters/` (`memory`, `redis`, `valkey`, `memcached`),
and `src/libs/registry.ts` maps a driver name to its adapter.

```
CACHE_DRIVER=memory        # memory | redis | valkey | memcached
CACHE_TTL=60               # default entry lifetime, in SECONDS
CACHE_KEY_PREFIX=          # prepended to every key; set it on a shared cache server
CACHE_MAX_ENTRIES=10000    # memory driver only: cap before LRU eviction
```

`memory` is the default, so the app runs with no cache configuration at all.
The module is already registered in `app.module.ts` and is global — just inject
`CachingService`:

```typescript
import { CachingService } from '@core/modules/caching/caching.service';

@Injectable()
export class ProfileService {
  constructor(private readonly caching: CachingService) {}

  async find(id: string) {
    const cached = await this.caching.get<Profile>(`profile:${id}`);
    if (cached) return cached;

    const profile = await this.repo.findOne(id);
    await this.caching.set(`profile:${id}`, profile, 300); // seconds
    return profile;
  }
}
```

**TTL is in seconds**, everywhere — the port, the config and every adapter.

**Reads fail open.** If the cache server is unreachable, `get` returns
`undefined`, `has` returns `false`, and writes are dropped; the failure is
logged at `error` level and the request continues without a cache. A broken
cache makes things slower, never a 500 — which also means it is invisible in
responses, so `GET /health` is what tells you the cache is down.

`CachingService` exposes `get` / `set` / `delete` / `has` / `namespace` — but
not `clear`. The drivers implement `clear` as a full flush, which
`CACHE_KEY_PREFIX` does not scope, so on a shared cache server it would take
every other app and environment with it. It stays on the adapter, for tests.

The port is deliberately the intersection of what all four drivers can do.
Memcached has no sorted sets, pipelines or `SCAN`, so those are not caching
features — a leaderboard or sliding-window counter needs its own port. The
Memcached adapter also rejects a TTL over 30 days (memcached would read it as
an absolute 1970 timestamp) and keys over 250 bytes, rather than failing
obscurely at runtime.

## Claude PR Review

Pull requests targeting `dev` are automatically reviewed by Claude via the
[`claude-pr-review.yml`](.github/workflows/claude-pr-review.yml) GitHub Actions
workflow ([`anthropics/claude-code-action`](https://github.com/anthropics/claude-code-action)).
Claude posts a top-level summary plus inline comments on the PR — it does not
push commits or block merging.

### Setup (per repository)

Requires admin access to the GitHub repo.

1. **Install the Claude GitHub App** on the repository: https://github.com/apps/claude

2. **Generate an auth token.** Two options:
   - `CLAUDE_CODE_OAUTH_TOKEN` — uses your Claude Pro/Max/Team/Enterprise subscription. Generate locally:
     ```bash
     claude setup-token
     ```
   - `ANTHROPIC_API_KEY` — a Claude Console API key, billed separately from any subscription. Use this for shared/org-wide setups, since an OAuth token is tied to the subscription of whoever ran `setup-token`.

3. **Add the token as a repo secret** (Settings → Secrets and variables → Actions), or via CLI:
   ```bash
   gh secret set CLAUDE_CODE_OAUTH_TOKEN --repo <owner>/<repo>
   ```
   If you used an API key instead, name the secret `ANTHROPIC_API_KEY` and update the
   `with:` input in the workflow file from `claude_code_oauth_token` to `anthropic_api_key`.

4. Copy [`.github/workflows/claude-pr-review.yml`](.github/workflows/claude-pr-review.yml)
   into the target repository and adjust the `branches:` filter if it should trigger on a
   branch other than `dev`.

### Notes

- Secrets are withheld from workflow runs triggered by PRs from forks, so review only runs
  on PRs from branches within the same repository.
- An OAuth token (`CLAUDE_CODE_OAUTH_TOKEN`) draws from the token-holder's Claude subscription
  usage limits (rolling 5-hour and weekly windows, shared across all models). If that limit is
  hit, review runs are blocked with a `You've hit your session/weekly limit` error until the
  window resets — there's no automatic fallback to API billing, unless the token-holder has
  enabled [usage credits](https://support.claude.com/en/articles/12429409-extra-usage-for-paid-claude-plans)
  on their account to buy extra usage. Use `ANTHROPIC_API_KEY` instead if you need reviews to
  keep running regardless of a subscription's usage limits.

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Thai Nguyen](https://github.com/nxthai23)

## License

Nest is [MIT licensed](LICENSE).
