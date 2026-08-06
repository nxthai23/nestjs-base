# Apply ApiResult to Existing Controllers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every existing controller method returns `ApiResult.success(data, message)` with a meaningful, endpoint-specific message instead of raw data, and drops its dead `try { ... } catch (err) { throw err; }` boilerplate.

**Architecture:** No new abstractions. `ApiResult` and the global `ResponseInterceptor` already exist (merged in `feat/core/api-response`, PR #1). This plan only touches call sites: 3 controllers, 7 methods, each wrapping its return value.

**Tech Stack:** NestJS 11, TypeScript 6.

## Global Constraints

- Import `ApiResult` via the `@core/*` path alias (`@core/response/api-result`) — these controller files live under `src/api/*`, outside `src/core`, so the alias applies (unlike files inside `src/core` itself, which use relative imports per the earlier `ApiResult`/`ResponseInterceptor` plan).
- Do not add controller-level tests — the codebase has no existing `*.controller.spec.ts` files, and introducing that convention is out of scope for this mechanical change.
- Do not change status codes, guards, filters, serialization decorators, or any other existing decorator/behavior — only the return statement (wrap in `ApiResult.success`) and removal of the no-op `try/catch`.
- Exact messages (fixed by the approved design, do not deviate):
  - `AppConfigController.findAll` → `"App configs retrieved successfully"`
  - `UserController.fetch` → `"Users retrieved successfully"`
  - `UserController.findOne` → `"User retrieved successfully"`
  - `UserController.update` → `"User updated successfully"`
  - `UserController.delete` → `"User deleted successfully"`
  - `AuthController.login` → `"Login successful"`
  - `AuthController.signIn` → `"User registered successfully"`
- Follow existing commit convention: Conventional Commits.

---

### Task 1: Wrap all controller responses in ApiResult.success()

**Files:**
- Modify: `src/api/app-config/app-config.controller.ts`
- Modify: `src/api/user/user.controller.ts`
- Modify: `src/api/auth/auth.controller.ts`

**Interfaces:**
- Consumes: `ApiResult` from `@core/response/api-result` (`ApiResult.success<T>(data: T, message?: string, statusCode?: number): ApiResult<T>`, already implemented and merged)

- [ ] **Step 1: Update `src/api/app-config/app-config.controller.ts`**

Current:

```typescript
import { Controller, Get } from '@nestjs/common';
import { AppConfigService } from './app-config.service';

@Controller('app-config')
export class AppConfigController {
  constructor(private readonly appConfigService: AppConfigService) {}

  @Get()
  findAll() {
    return this.appConfigService.findAllActivePublicConfigs();
  }
}
```

Replace with:

```typescript
import { Controller, Get } from '@nestjs/common';
import { AppConfigService } from './app-config.service';
import { ApiResult } from '@core/response/api-result';

@Controller('app-config')
export class AppConfigController {
  constructor(private readonly appConfigService: AppConfigService) {}

  @Get()
  async findAll() {
    const configs = await this.appConfigService.findAllActivePublicConfigs();
    return ApiResult.success(configs, 'App configs retrieved successfully');
  }
}
```

- [ ] **Step 2: Update `src/api/user/user.controller.ts`**

Current:

```typescript
import {
  Controller,
  Get,
  Body,
  Patch,
  Delete,
  UseGuards,
  UseInterceptors,
  SerializeOptions,
  Req,
  UseFilters,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '@/core/guard/jwt.auth.guard';
import { UserSerialize } from './interceptor/user.interceptor';
import { HttpExceptionFilter } from '@/core/filter/http-exception.filter';

// @TODO: add admin validation later for this controller

@Controller('users')
@UseGuards(JwtAuthGuard)
@SerializeOptions({
  excludePrefixes: ['password'],
})
@UseInterceptors(UserSerialize)
@UseFilters(HttpExceptionFilter)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  async fetch() {
    try {
      return this.userService.findAll();
    } catch (err) {
      throw err;
    }
  }

  @Get('/me')
  async findOne(@Req() req: Request) {
    try {
      const userId = req['userId'];
      return await this.userService.findById(userId);
    } catch (err) {
      throw err;
    }
  }

  @Patch('/me')
  update(@Req() req: Request, @Body() updateUserDto: UpdateUserDto) {
    try {
      const userId = req['userId'];
      return this.userService.update(userId, updateUserDto);
    } catch (err) {
      throw err;
    }
  }

  @Delete('/me')
  delete(@Req() req: Request) {
    try {
      const userId = req['userId'];
      return this.userService.delete(userId);
    } catch (err) {
      throw err;
    }
  }
}
```

Replace with:

```typescript
import {
  Controller,
  Get,
  Body,
  Patch,
  Delete,
  UseGuards,
  UseInterceptors,
  SerializeOptions,
  Req,
  UseFilters,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '@/core/guard/jwt.auth.guard';
import { UserSerialize } from './interceptor/user.interceptor';
import { HttpExceptionFilter } from '@/core/filter/http-exception.filter';
import { ApiResult } from '@core/response/api-result';

// @TODO: add admin validation later for this controller

@Controller('users')
@UseGuards(JwtAuthGuard)
@SerializeOptions({
  excludePrefixes: ['password'],
})
@UseInterceptors(UserSerialize)
@UseFilters(HttpExceptionFilter)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  async fetch() {
    const users = await this.userService.findAll();
    return ApiResult.success(users, 'Users retrieved successfully');
  }

  @Get('/me')
  async findOne(@Req() req: Request) {
    const userId = req['userId'];
    const user = await this.userService.findById(userId);
    return ApiResult.success(user, 'User retrieved successfully');
  }

  @Patch('/me')
  async update(@Req() req: Request, @Body() updateUserDto: UpdateUserDto) {
    const userId = req['userId'];
    const user = await this.userService.update(userId, updateUserDto);
    return ApiResult.success(user, 'User updated successfully');
  }

  @Delete('/me')
  async delete(@Req() req: Request) {
    const userId = req['userId'];
    const user = await this.userService.delete(userId);
    return ApiResult.success(user, 'User deleted successfully');
  }
}
```

Note: `update` and `delete` gain `async`/`await` since they now need the resolved value before wrapping it (previously they returned the promise directly, letting Nest await it).

- [ ] **Step 3: Update `src/api/auth/auth.controller.ts`**

Current:

```typescript
import {
  Controller,
  Post,
  Body,
  SerializeOptions,
  UseInterceptors,
  UseFilters,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignInDto } from './dto/signIn.dto';
import { LoginDto } from './dto/login.dto';
import { UserSerialize } from '@/api/user/interceptor/user.interceptor';
import { HttpExceptionFilter } from '@/core/filter/http-exception.filter';

@Controller('auth')
@UseFilters(HttpExceptionFilter)
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @SerializeOptions({
    excludePrefixes: ['password'],
  })
  @UseInterceptors(UserSerialize)
  async login(@Body() loginDto: LoginDto) {
    try {
      const { type, username, password } = loginDto;
      const result = await this.authService.login(type, username, password);
      return result;
    } catch (err) {
      throw err;
    }
  }

  @Post('signIn')
  async signIn(@Body() signInDto: SignInDto) {
    try {
      const { type, user } = signInDto;
      const result = await this.authService.signIn(type, user);
      return result;
    } catch (err) {
      throw err;
    }
  }
}
```

Replace with:

```typescript
import {
  Controller,
  Post,
  Body,
  SerializeOptions,
  UseInterceptors,
  UseFilters,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignInDto } from './dto/signIn.dto';
import { LoginDto } from './dto/login.dto';
import { UserSerialize } from '@/api/user/interceptor/user.interceptor';
import { HttpExceptionFilter } from '@/core/filter/http-exception.filter';
import { ApiResult } from '@core/response/api-result';

@Controller('auth')
@UseFilters(HttpExceptionFilter)
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @SerializeOptions({
    excludePrefixes: ['password'],
  })
  @UseInterceptors(UserSerialize)
  async login(@Body() loginDto: LoginDto) {
    const { type, username, password } = loginDto;
    const result = await this.authService.login(type, username, password);
    return ApiResult.success(result, 'Login successful');
  }

  @Post('signIn')
  async signIn(@Body() signInDto: SignInDto) {
    const { type, user } = signInDto;
    const result = await this.authService.signIn(type, user);
    return ApiResult.success(result, 'User registered successfully');
  }
}
```

- [ ] **Step 4: Verify the app builds**

Run: `pnpm run build`
Expected: exits 0, no TypeScript errors.

- [ ] **Step 5: Run the full test suite to check for regressions**

Run: `pnpm run test`
Expected: all suites PASS (81/81 as of the last full run on this branch).

- [ ] **Step 6: Commit**

```bash
git add src/api/app-config/app-config.controller.ts src/api/user/user.controller.ts src/api/auth/auth.controller.ts
git commit -m "feat(api): apply ApiResult envelope with descriptive messages to controllers"
```

---

## Final verification

- [ ] Run `pnpm run test` — all suites pass
- [ ] Run `pnpm run build` — no TypeScript errors
