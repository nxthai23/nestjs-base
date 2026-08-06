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

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Thai Nguyen](https://github.com/nxthai23)

## License

Nest is [MIT licensed](LICENSE).
