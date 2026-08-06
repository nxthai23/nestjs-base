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
