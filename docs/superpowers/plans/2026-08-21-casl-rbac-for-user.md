# CASL-based RBAC for User Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce role-based access on `UserController` using CASL, with roles and permissions stored in the database (`Role`/`Permission` entities, one role per user) instead of hardcoded enums, seeded with a default `admin`/`user` setup.

**Architecture:** A `PoliciesGuard` builds a per-request `AppAbility` via `CaslAbilityFactory.createForUser(request.user)`, which maps the user's `role.permissions` DB rows directly into CASL rules (interpolating `$field` ownership placeholders against the requesting user). `@CheckPolicies()` decorates each route with an `(ability, request) => boolean` handler. Applied per-controller as `@UseGuards(JwtAuthGuard, PoliciesGuard)`, matching this repo's existing per-controller guard convention — no global `APP_GUARD`.

**Tech Stack:** NestJS 11, MikroORM 7 (MongoDB driver, `DB_TYPE=mongodb` default), `@casl/ability` v7, TypeScript 6, Jest.

## Global Constraints

- Follow the approved spec exactly: `docs/superpowers/specs/2026-08-21-casl-rbac-for-user-design.md`.
- One role per user (`User.role: Role`, `@ManyToOne`), not many-to-many.
- `Permission.action` / `Permission.subject` are plain DB strings, not enums — the in-code `Action` enum (`src/core/casl/action.enum.ts`) is only a typing convenience for `@CheckPolicies()` call sites, never a constraint on what can be stored.
- No admin CRUD API for `Role`/`Permission` in this plan — schema + seeder only.
- No client-settable `role` on any DTO — `CreateUserDto` only exposes `username`/`password`; the default `user` role is resolved server-side in `UserService.createWithDefaultRole`.
- New entities (`Role`, `Permission`) follow this repo's existing entity style exactly: `@mikro-orm/decorators/legacy` imports, hardcoded `@PrimaryKey() _id!: ObjectId` from `@mikro-orm/mongodb` (matching `User`/`AppConfig` — not verified against `DB_TYPE=postgresql`, no compose service exists for it), `constructor(partial: Partial<X>) { super(); Object.assign(this, partial); }`.
- Task order matters here: `CaslAbilityFactory` reads `user.role.permissions`, so `User.role` must exist (and type-check) before `CaslAbilityFactory` is written — that's why the `User` entity change (Task 4) comes before the CASL core (Task 6), not after, even though conceptually "CASL core" and "user wiring" feel like they'd group together.
- Follow existing commit convention: Conventional Commits, one commit per task.
- Test location convention: colocated `__tests__/` folders (e.g. `src/api/role/__tests__/role.service.spec.ts`), matching `src/core/response/__tests__/api-result.spec.ts`.
- Run tests with `pnpm run test -- <path>`, matching `CLAUDE.md`.

---

### Task 1: Add `@casl/ability` dependency

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: `@casl/ability` package (`AbilityBuilder`, `createMongoAbility`, `MongoAbility`, `InferSubjects`, `RawRuleOf`, `subject`) available to every later task.

- [ ] **Step 1: Install the package**

Run:
```bash
pnpm add @casl/ability
```
Expected: `package.json` `dependencies` gains `"@casl/ability": "^7.0.1"` (or whatever `^7.x` pnpm resolves), `pnpm-lock.yaml` updates, exit code 0.

- [ ] **Step 2: Verify it resolves**

Run:
```bash
node -e "console.log(Object.keys(require('@casl/ability')).sort())"
```
Expected: output includes `AbilityBuilder`, `createMongoAbility`, `subject` among the exported keys.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add @casl/ability dependency"
```

---

### Task 2: `Role`/`Permission` entities + `RoleService` + `RoleModule`

**Files:**
- Create: `src/api/role/entities/role.entity.ts`
- Create: `src/api/role/entities/permission.entity.ts`
- Create: `src/api/role/role.service.ts`
- Create: `src/api/role/role.module.ts`
- Test: `src/api/role/__tests__/role.service.spec.ts`

**Interfaces:**
- Consumes: `BaseEntity` (`src/core/base/base.entity.ts`, adds `id: string`, `createdAt`, `updatedAt`), `BaseService<T>` (`src/core/base/base.service.ts`, provides `findById`/`findAll`/`find`/`count`/`create`/`update`/`delete`/`upsert`/`getRepository()`).
- Produces: `Role` entity (`_id`, `name: string` unique, `permissions: Collection<Permission>`), `Permission` entity (`_id`, `action: string`, `subject: string`, `conditions?: Record<string, unknown>`, `inverted?: boolean`, `role: Role`), `RoleService.findByName(name: string): Promise<Role | null>`, `RoleModule` exporting `RoleService`. Task 4 (`UserService`) and Task 9 (smoke test) depend on `RoleService.findByName`.

- [ ] **Step 1: Create `src/api/role/entities/permission.entity.ts`**

```typescript
import { Entity, PrimaryKey, Property, ManyToOne } from '@mikro-orm/decorators/legacy';
import { ObjectId } from '@mikro-orm/mongodb';
import { BaseEntity } from '@core/base/base.entity';
import { Role } from './role.entity';

@Entity({ collection: 'permissions' })
export class Permission extends BaseEntity {
  @PrimaryKey()
  _id!: ObjectId;

  @Property()
  action!: string;

  @Property()
  subject!: string;

  @Property({ type: Object, nullable: true })
  conditions?: Record<string, unknown>;

  @Property({ nullable: true })
  inverted?: boolean;

  @ManyToOne(() => Role)
  role!: Role;

  constructor(partial: Partial<Permission>) {
    super();
    Object.assign(this, partial);
  }
}
```

- [ ] **Step 2: Create `src/api/role/entities/role.entity.ts`**

```typescript
import { Entity, PrimaryKey, Property, OneToMany } from '@mikro-orm/decorators/legacy';
import { Collection } from '@mikro-orm/core';
import { ObjectId } from '@mikro-orm/mongodb';
import { BaseEntity } from '@core/base/base.entity';
import { Permission } from './permission.entity';

@Entity({ collection: 'roles' })
export class Role extends BaseEntity {
  @PrimaryKey()
  _id!: ObjectId;

  @Property({ unique: true })
  name!: string;

  @OneToMany(() => Permission, (permission) => permission.role)
  permissions = new Collection<Permission>(this);

  constructor(partial: Partial<Role>) {
    super();
    Object.assign(this, partial);
  }
}
```

(`ManyToOne`/`OneToMany` take a lazy `() => Role` / `() => Permission` callback specifically so this circular import between the two entity files resolves correctly — standard MikroORM practice, same reason `User`/`AppConfig` don't need it since they have no relations today.)

- [ ] **Step 3: Create `src/api/role/role.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { Role } from './entities/role.entity';
import { BaseService } from '@core/base/base.service';

@Injectable()
export class RoleService extends BaseService<Role> {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: EntityRepository<Role>,
  ) {
    super(roleRepository);
  }

  async findByName(name: string): Promise<Role | null> {
    return this.roleRepository.findOne({ name });
  }
}
```

- [ ] **Step 4: Write the failing test — `src/api/role/__tests__/role.service.spec.ts`**

```typescript
import { RoleService } from '../role.service';

describe('RoleService', () => {
  function makeService(findOne: jest.Mock) {
    const repository = {
      findOne,
      getEntityName: () => 'Role',
      getEntityManager: () => ({}),
    } as any;
    return new RoleService(repository);
  }

  it('findByName looks up a role by its name field', async () => {
    const findOne = jest.fn().mockResolvedValue({ id: 'role-1', name: 'admin' });
    const service = makeService(findOne);

    const result = await service.findByName('admin');

    expect(findOne).toHaveBeenCalledWith({ name: 'admin' });
    expect(result).toEqual({ id: 'role-1', name: 'admin' });
  });

  it('returns null when no role matches', async () => {
    const findOne = jest.fn().mockResolvedValue(null);
    const service = makeService(findOne);

    const result = await service.findByName('nonexistent');

    expect(result).toBeNull();
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `pnpm run test -- src/api/role/__tests__/role.service.spec.ts`
Expected: FAIL — `Cannot find module '../role.service'` (if this step runs before Step 3 creates the file; if Step 3 is already done, this step will instead just pass — confirm at Step 7 either way).

- [ ] **Step 6: Create `src/api/role/role.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Role } from './entities/role.entity';
import { RoleService } from './role.service';

@Module({
  imports: [MikroOrmModule.forFeature([Role])],
  providers: [RoleService],
  exports: [RoleService],
})
export class RoleModule {}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `pnpm run test -- src/api/role/__tests__/role.service.spec.ts`
Expected: PASS, 2 tests.

- [ ] **Step 8: Commit**

```bash
git add src/api/role
git commit -m "feat: add Role and Permission entities with RoleService"
```

---

### Task 3: Seed default `admin`/`user` roles and permissions

**Files:**
- Create: `src/core/database/seeder/data/role.data.ts`
- Create: `src/core/database/seeder/scripts/role.seeder.ts`
- Modify: `src/core/database/seeder/seeder.ts`
- Modify: `src/core/database/seeder/seeder.module.ts`

**Interfaces:**
- Consumes: `Role`, `Permission` (Task 2), `findCreateData` (`src/utils/array.util.ts`, already used by `AppConfigSeeder`).
- Produces: on startup with `ENABLE_SEEDER=1`, a `Role` document named `admin` with one `Permission` (`{ action: 'manage', subject: 'all' }`), and a `Role` document named `user` with three `Permission`s (`read`/`update`/`delete` on `subject: 'User'`, each `conditions: { id: '$id' }`). Task 4 (`UserService.createWithDefaultRole`) depends on the `user` role existing; Task 9 (smoke test) depends on both.

There's no existing precedent in this repo for unit-testing a seeder (`AppConfigSeeder` has no spec file) — this task is verified via the Task 9 manual smoke test instead, consistent with that convention.

- [ ] **Step 1: Create `src/core/database/seeder/data/role.data.ts`**

```typescript
export const roleData = [
  {
    name: 'admin',
    permissions: [{ action: 'manage', subject: 'all' }],
  },
  {
    name: 'user',
    permissions: [
      { action: 'read', subject: 'User', conditions: { id: '$id' } },
      { action: 'update', subject: 'User', conditions: { id: '$id' } },
      { action: 'delete', subject: 'User', conditions: { id: '$id' } },
    ],
  },
];
```

- [ ] **Step 2: Create `src/core/database/seeder/scripts/role.seeder.ts`**

```typescript
import { EntityManager } from '@mikro-orm/core';
import { Seeder } from '@mikro-orm/seeder';
import { Logger } from '@nestjs/common';
import { Role } from '@api/role/entities/role.entity';
import { Permission } from '@api/role/entities/permission.entity';
import { findCreateData } from '@utils/array.util';
import { roleData } from '../data/role.data';

export class RoleSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    Logger.log('---------- Start RoleSeeder ----------');
    const existingRoles = await em.find(Role, {});

    const createdNewRoles = findCreateData<Role>(existingRoles, roleData, 'name');

    createdNewRoles.forEach((item) => {
      const role = em.create(Role, { name: item.name } as any);
      em.persist(role);
    });

    await em.flush();
    Logger.log(`Created ${createdNewRoles.length} new roles`);

    const allRoles = await em.find(Role, {});
    let createdPermissionCount = 0;

    for (const roleEntry of roleData) {
      const role = allRoles.find((r) => r.name === roleEntry.name);
      if (!role) {
        continue;
      }

      const existingPermissionCount = await em.count(Permission, { role });
      if (existingPermissionCount > 0) {
        continue;
      }

      roleEntry.permissions.forEach((permission) => {
        const newPermission = em.create(Permission, { ...permission, role } as any);
        em.persist(newPermission);
        createdPermissionCount += 1;
      });
    }

    await em.flush();
    Logger.log(`Created ${createdPermissionCount} new permissions`);
    Logger.log('---------- End RoleSeeder ----------');
  }
}
```

(Permissions are seeded as an all-or-nothing set per role — if a role already has any `Permission` rows, its set is left alone rather than diffed row-by-row. This mirrors `AppConfigSeeder`'s idempotency goal — safe to re-run — without needing a composite-key diff for relational child rows, which isn't needed for this example's fixed default set.)

- [ ] **Step 3: Register in `src/core/database/seeder/seeder.ts`**

Current:
```typescript
import { EntityManager } from '@mikro-orm/core';
import { Seeder } from '@mikro-orm/seeder';
import { AppConfigSeeder } from './scripts/app-config.seeder';

export class DatabaseSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    return this.call(em, [
      AppConfigSeeder,
      // Add other seeders here
    ]);
  }
}
```

Replace with:
```typescript
import { EntityManager } from '@mikro-orm/core';
import { Seeder } from '@mikro-orm/seeder';
import { AppConfigSeeder } from './scripts/app-config.seeder';
import { RoleSeeder } from './scripts/role.seeder';

export class DatabaseSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    return this.call(em, [
      AppConfigSeeder,
      RoleSeeder,
      // Add other seeders here
    ]);
  }
}
```

- [ ] **Step 4: Register `Role`/`Permission` in `src/core/database/seeder/seeder.module.ts`**

Current:
```typescript
import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { SeederService } from './seeder.service';
import { AppConfig } from '@api/app-config/entities/app-config.entity';

@Module({
  imports: [MikroOrmModule.forFeature([AppConfig])],
  controllers: [],
  providers: [SeederService],
  exports: [SeederService],
})
export class SeederModule {}
```

Replace with:
```typescript
import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { SeederService } from './seeder.service';
import { AppConfig } from '@api/app-config/entities/app-config.entity';
import { Role } from '@api/role/entities/role.entity';
import { Permission } from '@api/role/entities/permission.entity';

@Module({
  imports: [MikroOrmModule.forFeature([AppConfig, Role, Permission])],
  controllers: [],
  providers: [SeederService],
  exports: [SeederService],
})
export class SeederModule {}
```

- [ ] **Step 5: Type-check**

Run: `pnpm run build`
Expected: exit code 0, no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/core/database/seeder
git commit -m "feat: seed default admin/user roles and permissions"
```

---

### Task 4: `User.role` relation + `CreateUserDto` fix + `UserService.createWithDefaultRole`

**Files:**
- Modify: `src/api/user/entities/user.entity.ts`
- Modify: `src/api/user/dto/create-user.dto.ts`
- Modify: `src/api/user/user.service.ts`
- Modify: `src/api/user/user.module.ts`
- Test: `src/api/user/__tests__/user.service.spec.ts`

**Interfaces:**
- Consumes: `Role`, `RoleService.findByName` (Task 2), `RoleModule` (Task 2).
- Produces: `User.role: Role` (required relation — this is what Task 6's `CaslAbilityFactory` needs to type-check against), `CreateUserDto` exposing only `username`/`password`, `UserService.createWithDefaultRole(data: { username: string; password: string }): Promise<Partial<User>>`. Task 5 (`AuthService.signIn`) depends on `createWithDefaultRole`; Task 6 depends on `User.role` existing; Task 7 depends on `User.role` existing for the populate to be meaningful.

- [ ] **Step 1: Modify `src/api/user/entities/user.entity.ts`**

Current:
```typescript
import { Entity, Property, PrimaryKey } from '@mikro-orm/decorators/legacy';
import { ObjectId } from '@mikro-orm/mongodb';
import { BaseEntity } from '../../../core/base/base.entity';
import { Exclude } from 'class-transformer';

@Entity({
  collection: 'users',
})
export class User extends BaseEntity {
  @PrimaryKey()
  _id!: ObjectId;

  @Property()
  username!: string;

  @Property()
  @Exclude()
  password!: string;

  constructor(partial: Partial<User>) {
    super();
    Object.assign(this, partial);
  }
}
```

Replace with:
```typescript
import { Entity, Property, PrimaryKey, ManyToOne } from '@mikro-orm/decorators/legacy';
import { ObjectId } from '@mikro-orm/mongodb';
import { BaseEntity } from '../../../core/base/base.entity';
import { Exclude } from 'class-transformer';
import { Role } from '@api/role/entities/role.entity';

@Entity({
  collection: 'users',
})
export class User extends BaseEntity {
  @PrimaryKey()
  _id!: ObjectId;

  @Property()
  username!: string;

  @Property()
  @Exclude()
  password!: string;

  @ManyToOne(() => Role)
  role!: Role;

  constructor(partial: Partial<User>) {
    super();
    Object.assign(this, partial);
  }
}
```

- [ ] **Step 2: Modify `src/api/user/dto/create-user.dto.ts`**

Current:
```typescript
import { PartialType } from '@nestjs/mapped-types';
import { User } from '../entities/user.entity';

export class CreateUserDto extends PartialType(User) {
  username: string;
  password: string;
}
```

Replace with:
```typescript
import { PickType } from '@nestjs/mapped-types';
import { User } from '../entities/user.entity';

export class CreateUserDto extends PickType(User, ['username', 'password'] as const) {}
```

(`UpdateUserDto extends PartialType(CreateUserDto)` in `src/api/user/dto/update-user.dto.ts` needs no change — it automatically inherits the `username`/`password`-only shape, so `role` was never and is still never settable via `PATCH /users/me`.)

- [ ] **Step 3: Write the failing test — `src/api/user/__tests__/user.service.spec.ts`**

```typescript
import { InternalServerErrorException } from '@nestjs/common';
import { UserService } from '../user.service';
import { RoleService } from '@api/role/role.service';

describe('UserService.createWithDefaultRole', () => {
  function makeUserService(roleService: Partial<RoleService>) {
    const repository = {
      getEntityName: () => 'User',
      getEntityManager: () => ({
        persist: jest.fn(),
        flush: jest.fn().mockResolvedValue(undefined),
      }),
      create: jest.fn((dto: any) => dto),
    } as any;
    return new UserService(repository, roleService as RoleService);
  }

  it('attaches the default "user" role when creating an account', async () => {
    const defaultRole = { id: 'role-user', name: 'user' };
    const roleService = { findByName: jest.fn().mockResolvedValue(defaultRole) };
    const service = makeUserService(roleService);

    const result = await service.createWithDefaultRole({
      username: 'alice',
      password: 'hashed',
    });

    expect(roleService.findByName).toHaveBeenCalledWith('user');
    expect(result.role).toBe(defaultRole);
    expect(result.username).toBe('alice');
  });

  it('throws when the default "user" role has not been seeded', async () => {
    const roleService = { findByName: jest.fn().mockResolvedValue(null) };
    const service = makeUserService(roleService);

    await expect(
      service.createWithDefaultRole({ username: 'alice', password: 'hashed' }),
    ).rejects.toThrow(InternalServerErrorException);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm run test -- src/api/user/__tests__/user.service.spec.ts`
Expected: FAIL — `createWithDefaultRole is not a function` (the method doesn't exist yet, and `UserService` doesn't yet accept a second constructor argument).

- [ ] **Step 5: Modify `src/api/user/user.service.ts`**

Current:
```typescript
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { User } from './entities/user.entity';
import { BaseService } from '@/core/base/base.service';

@Injectable()
export class UserService extends BaseService<User> {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
  ) {
    super(userRepository);
  }

  async findByUsername(username: string): Promise<User> {
    const user = await this.userRepository.findOne({ username });
    if (!user) {
      throw new BadRequestException('User Not Found');
    }
    return user;
  }
}
```

Replace with:
```typescript
import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository, RequiredEntityData } from '@mikro-orm/core';
import { User } from './entities/user.entity';
import { BaseService } from '@/core/base/base.service';
import { RoleService } from '@api/role/role.service';

@Injectable()
export class UserService extends BaseService<User> {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
    private readonly roleService: RoleService,
  ) {
    super(userRepository);
  }

  async findByUsername(username: string): Promise<User> {
    const user = await this.userRepository.findOne({ username });
    if (!user) {
      throw new BadRequestException('User Not Found');
    }
    return user;
  }

  async createWithDefaultRole(data: {
    username: string;
    password: string;
  }): Promise<Partial<User>> {
    const defaultRole = await this.roleService.findByName('user');
    if (!defaultRole) {
      throw new InternalServerErrorException('Default "user" role is not seeded');
    }
    return this.create({
      ...data,
      role: defaultRole,
    } as RequiredEntityData<User>);
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm run test -- src/api/user/__tests__/user.service.spec.ts`
Expected: PASS, 2 tests.

- [ ] **Step 7: Modify `src/api/user/user.module.ts`**

Current:
```typescript
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { User } from './entities/user.entity';
import { JwtMiddleware } from '@/core/middlewares/jwt.middleware';
import { JwtService } from '@nestjs/jwt';
import { JwtStrategy } from '@/api/auth/strategies/jwt';
import { MikroOrmModule } from '@mikro-orm/nestjs';

@Module({
  imports: [MikroOrmModule.forFeature([User])],
  controllers: [UserController],
  providers: [UserService, JwtService, JwtStrategy],
  exports: [UserService],
})
export class UserModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(JwtMiddleware).forRoutes(UserController);
  }
}
```

Replace with:
```typescript
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { User } from './entities/user.entity';
import { JwtMiddleware } from '@/core/middlewares/jwt.middleware';
import { JwtService } from '@nestjs/jwt';
import { JwtStrategy } from '@/api/auth/strategies/jwt';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RoleModule } from '@api/role/role.module';

@Module({
  imports: [MikroOrmModule.forFeature([User]), RoleModule],
  controllers: [UserController],
  providers: [UserService, JwtService, JwtStrategy],
  exports: [UserService],
})
export class UserModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(JwtMiddleware).forRoutes(UserController);
  }
}
```

(`CaslModule` isn't imported here yet — it doesn't exist until Task 6. Task 8 will modify this file again to add it, once `PoliciesGuard` is actually wired into `UserController`.)

- [ ] **Step 8: Type-check**

Run: `pnpm run build`
Expected: exit code 0, no TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add src/api/user/entities/user.entity.ts src/api/user/dto/create-user.dto.ts src/api/user/user.service.ts src/api/user/user.module.ts src/api/user/__tests__/user.service.spec.ts
git commit -m "feat: add role relation to User and default-role assignment on create"
```

---

### Task 5: Wire role-aware auth — `AuthService.signIn` + `JwtStrategy.validate`

**Files:**
- Modify: `src/api/auth/auth.service.ts`
- Modify: `src/api/auth/strategies/jwt.ts`

**Interfaces:**
- Consumes: `UserService.createWithDefaultRole` (Task 4), `UserService.findById(id, populate?)` (existing, `src/core/base/base.service.ts`).
- Produces: every signed-up user gets the seeded `user` role; every authenticated request has `request.user.role.permissions` populated. Task 8 (`PoliciesGuard`/`CaslAbilityFactory` via `UserController`) depends on this populate.

No new automated test here — there's no existing test infrastructure for `AuthService`/`JwtStrategy` in this repo (both depend on Passport strategy bootstrapping that isn't unit-tested elsewhere), and this task's effect (role assignment on signup, populate on login) is covered by the Task 9 manual smoke test.

- [ ] **Step 1: Modify `src/api/auth/auth.service.ts`**

Current:
```typescript
  async signIn(authType: string, user: CreateUserDto): Promise<User> {
    const { username, password } = user;
    const hashPassword = await this.localStrategy.hash(password);
    const userData: Partial<CreateUserDto> = {
      username,
      password: hashPassword,
    };
    let result: any;
    switch (authType.toUpperCase()) {
      case this.configService.get<string>('local'):
        const user = await this.userService.create(userData);
        result = user;
        break;
      default:
        throw new Error(`Auth type: ${authType} not supported`);
    }
    return result;
  }
```

Replace with:
```typescript
  async signIn(authType: string, user: CreateUserDto): Promise<User> {
    const { username, password } = user;
    const hashPassword = await this.localStrategy.hash(password);
    const userData: Pick<CreateUserDto, 'username' | 'password'> = {
      username,
      password: hashPassword,
    };
    let result: any;
    switch (authType.toUpperCase()) {
      case this.configService.get<string>('local'):
        const user = await this.userService.createWithDefaultRole(userData);
        result = user;
        break;
      default:
        throw new Error(`Auth type: ${authType} not supported`);
    }
    return result;
  }
```

(Only the `userData` type annotation and the `create` → `createWithDefaultRole` call change — everything else in the method is untouched.)

- [ ] **Step 2: Modify `src/api/auth/strategies/jwt.ts`**

Current:
```typescript
  async validate(payload: any) {
    const userId = payload.sub;
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
```

Replace with:
```typescript
  async validate(payload: any) {
    const userId = payload.sub;
    const user = await this.userService.findById(userId, ['role', 'role.permissions']);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
```

- [ ] **Step 3: Type-check**

Run: `pnpm run build`
Expected: exit code 0, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/api/auth/auth.service.ts src/api/auth/strategies/jwt.ts
git commit -m "feat: assign default role on signup and populate role/permissions on auth"
```

---

### Task 6: CASL core — `Action` enum, `interpolateConditions`, `CaslAbilityFactory`, `CaslModule`

**Files:**
- Create: `src/core/casl/action.enum.ts`
- Create: `src/core/casl/interpolate-conditions.util.ts`
- Create: `src/core/casl/casl-ability.factory.ts`
- Create: `src/core/casl/casl.module.ts`
- Test: `src/core/casl/__tests__/interpolate-conditions.util.spec.ts`
- Test: `src/core/casl/__tests__/casl-ability.factory.spec.ts`

**Interfaces:**
- Consumes: `User` entity with `role: Role` (Task 4).
- Produces: `Action` enum (`Manage`/`Create`/`Read`/`Update`/`Delete`), `interpolateConditions(conditions, user): Record<string, unknown>`, `AppAbility` type, `CaslAbilityFactory.createForUser(user: User): AppAbility`, `CaslModule` exporting `CaslAbilityFactory`. Task 7 (`PoliciesGuard`) and Task 8 (`UserController`) depend on `CaslAbilityFactory`, `AppAbility`, and `Action`.

- [ ] **Step 1: Create `src/core/casl/action.enum.ts`**

```typescript
export enum Action {
  Manage = 'manage',
  Create = 'create',
  Read = 'read',
  Update = 'update',
  Delete = 'delete',
}
```

- [ ] **Step 2: Write the failing test — `src/core/casl/__tests__/interpolate-conditions.util.spec.ts`**

```typescript
import { interpolateConditions } from '../interpolate-conditions.util';
import { User } from '@api/user/entities/user.entity';

describe('interpolateConditions', () => {
  it('replaces $field placeholders with the value from the user', () => {
    const user = { id: 'user-123' } as User;
    const result = interpolateConditions({ id: '$id' }, user);
    expect(result).toEqual({ id: 'user-123' });
  });

  it('passes through literal (non-$-prefixed) values unchanged', () => {
    const user = { id: 'user-123' } as User;
    const result = interpolateConditions({ status: 'active' }, user);
    expect(result).toEqual({ status: 'active' });
  });

  it('handles a mix of placeholder and literal values', () => {
    const user = { id: 'user-123' } as User;
    const result = interpolateConditions({ id: '$id', status: 'active' }, user);
    expect(result).toEqual({ id: 'user-123', status: 'active' });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm run test -- src/core/casl/__tests__/interpolate-conditions.util.spec.ts`
Expected: FAIL — `Cannot find module '../interpolate-conditions.util'`.

- [ ] **Step 4: Create `src/core/casl/interpolate-conditions.util.ts`**

```typescript
import { User } from '@api/user/entities/user.entity';

export function interpolateConditions(
  conditions: Record<string, unknown>,
  user: User,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(conditions)) {
    result[key] =
      typeof value === 'string' && value.startsWith('$')
        ? (user as unknown as Record<string, unknown>)[value.slice(1)]
        : value;
  }
  return result;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm run test -- src/core/casl/__tests__/interpolate-conditions.util.spec.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Write the failing test — `src/core/casl/__tests__/casl-ability.factory.spec.ts`**

```typescript
import { subject } from '@casl/ability';
import { CaslAbilityFactory } from '../casl-ability.factory';
import { User } from '@api/user/entities/user.entity';

type FakePermission = { action: string; subject: string; conditions?: Record<string, unknown> };

function makeUser(permissions: FakePermission[], id = 'user-1'): User {
  return {
    id,
    role: {
      permissions: {
        getItems: () => permissions,
      },
    },
  } as unknown as User;
}

describe('CaslAbilityFactory', () => {
  const factory = new CaslAbilityFactory();

  it('grants full access for an admin-shaped role (manage/all)', () => {
    const admin = makeUser([{ action: 'manage', subject: 'all' }]);
    const ability = factory.createForUser(admin);

    expect(ability.can('read', 'User')).toBe(true);
    expect(ability.can('delete', 'User')).toBe(true);
  });

  it('scopes a user-shaped role to only their own User record', () => {
    const owner = makeUser(
      [
        { action: 'read', subject: 'User', conditions: { id: '$id' } },
        { action: 'update', subject: 'User', conditions: { id: '$id' } },
      ],
      'user-1',
    );
    const ownRecord = { id: 'user-1' } as User;
    const otherRecord = { id: 'user-2' } as User;

    const ability = factory.createForUser(owner);

    expect(ability.can('read', subject('User', ownRecord))).toBe(true);
    expect(ability.can('update', subject('User', ownRecord))).toBe(true);
    expect(ability.can('read', subject('User', otherRecord))).toBe(false);
    expect(ability.can('delete', subject('User', ownRecord))).toBe(false);
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `pnpm run test -- src/core/casl/__tests__/casl-ability.factory.spec.ts`
Expected: FAIL — `Cannot find module '../casl-ability.factory'`.

- [ ] **Step 8: Create `src/core/casl/casl-ability.factory.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import {
  createMongoAbility,
  MongoAbility,
  InferSubjects,
  RawRuleOf,
} from '@casl/ability';
import { User } from '@api/user/entities/user.entity';
import { interpolateConditions } from './interpolate-conditions.util';

type Subjects = InferSubjects<typeof User> | 'all';
export type AppAbility = MongoAbility<[string, Subjects]>;

@Injectable()
export class CaslAbilityFactory {
  createForUser(user: User): AppAbility {
    const rules: RawRuleOf<AppAbility>[] = user.role.permissions
      .getItems()
      .map((permission) => ({
        action: permission.action,
        subject: permission.subject as Subjects,
        conditions: permission.conditions
          ? interpolateConditions(permission.conditions, user)
          : undefined,
        inverted: permission.inverted ?? false,
      }));

    return createMongoAbility<AppAbility>(rules);
  }
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `pnpm run test -- src/core/casl/__tests__/casl-ability.factory.spec.ts`
Expected: PASS, 2 tests.

- [ ] **Step 10: Create `src/core/casl/casl.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { CaslAbilityFactory } from './casl-ability.factory';

@Module({
  providers: [CaslAbilityFactory],
  exports: [CaslAbilityFactory],
})
export class CaslModule {}
```

- [ ] **Step 11: Commit**

```bash
git add src/core/casl
git commit -m "feat: add CASL ability factory driven by DB-stored role permissions"
```

---

### Task 7: `@CheckPolicies()` decorator + `PoliciesGuard`

**Files:**
- Create: `src/core/decorators/check-policies.decorator.ts`
- Create: `src/core/guard/policies.guard.ts`
- Test: `src/core/guard/__tests__/policies.guard.spec.ts`

**Interfaces:**
- Consumes: `AppAbility`, `CaslAbilityFactory` (Task 6).
- Produces: `PolicyHandlerCallback = (ability: AppAbility, request: any) => boolean`, `CHECK_POLICIES_KEY`, `CheckPolicies(...handlers)` decorator, `PoliciesGuard implements CanActivate`. Task 8 (`UserController`) depends on both.

- [ ] **Step 1: Create `src/core/decorators/check-policies.decorator.ts`**

```typescript
import { SetMetadata } from '@nestjs/common';
import { AppAbility } from '@core/casl/casl-ability.factory';

export type PolicyHandlerCallback = (ability: AppAbility, request: any) => boolean;

export const CHECK_POLICIES_KEY = 'check_policies';

export const CheckPolicies = (...handlers: PolicyHandlerCallback[]) =>
  SetMetadata(CHECK_POLICIES_KEY, handlers);
```

- [ ] **Step 2: Write the failing test — `src/core/guard/__tests__/policies.guard.spec.ts`**

```typescript
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PoliciesGuard } from '../policies.guard';
import { CaslAbilityFactory } from '@core/casl/casl-ability.factory';

describe('PoliciesGuard', () => {
  const mockUser = { id: 'user-1' };
  const mockAbility = { can: jest.fn() };

  function makeContext() {
    return {
      getHandler: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user: mockUser }),
      }),
    } as any;
  }

  function makeReflector(returnValue: any) {
    return { get: jest.fn().mockReturnValue(returnValue) } as unknown as Reflector;
  }

  function makeFactory() {
    return {
      createForUser: jest.fn().mockReturnValue(mockAbility),
    } as unknown as CaslAbilityFactory;
  }

  it('allows the request when there are no policy handlers', () => {
    const guard = new PoliciesGuard(makeReflector(undefined), makeFactory());
    expect(guard.canActivate(makeContext())).toBe(true);
  });

  it('allows the request when every handler passes', () => {
    const factory = makeFactory();
    const guard = new PoliciesGuard(makeReflector([() => true, () => true]), factory);

    expect(guard.canActivate(makeContext())).toBe(true);
    expect(factory.createForUser).toHaveBeenCalledWith(mockUser);
  });

  it('throws ForbiddenException when any handler fails', () => {
    const guard = new PoliciesGuard(makeReflector([() => true, () => false]), makeFactory());
    expect(() => guard.canActivate(makeContext())).toThrow(ForbiddenException);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm run test -- src/core/guard/__tests__/policies.guard.spec.ts`
Expected: FAIL — `Cannot find module '../policies.guard'`.

- [ ] **Step 4: Create `src/core/guard/policies.guard.ts`**

```typescript
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CaslAbilityFactory } from '@core/casl/casl-ability.factory';
import { CHECK_POLICIES_KEY, PolicyHandlerCallback } from '@core/decorators/check-policies.decorator';

@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private caslAbilityFactory: CaslAbilityFactory,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const handlers =
      this.reflector.get<PolicyHandlerCallback[]>(CHECK_POLICIES_KEY, context.getHandler()) ?? [];

    if (handlers.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const ability = this.caslAbilityFactory.createForUser(request.user);

    const allowed = handlers.every((handler) => handler(ability, request));
    if (!allowed) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm run test -- src/core/guard/__tests__/policies.guard.spec.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add src/core/decorators/check-policies.decorator.ts src/core/guard/policies.guard.ts src/core/guard/__tests__/policies.guard.spec.ts
git commit -m "feat: add CheckPolicies decorator and PoliciesGuard"
```

---

### Task 8: Wire `PoliciesGuard` + `@CheckPolicies()` into `UserController`

**Files:**
- Modify: `src/api/user/user.controller.ts`
- Modify: `src/api/user/user.module.ts`

**Interfaces:**
- Consumes: `JwtAuthGuard` (existing), `PoliciesGuard`, `CheckPolicies`, `Action`, `CaslModule` (Tasks 6–7).
- Produces: `GET /users` restricted to a role whose ability grants `read`/`all` (only the seeded `admin` role); `GET|PATCH|DELETE /users/me` restricted to the caller's own record (or an admin). Verified in Task 9.

- [ ] **Step 1: Modify `src/api/user/user.controller.ts`**

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
import { PoliciesGuard } from '@core/guard/policies.guard';
import { CheckPolicies } from '@core/decorators/check-policies.decorator';
import { Action } from '@core/casl/action.enum';
import { UserSerialize } from './interceptor/user.interceptor';
import { HttpExceptionFilter } from '@/core/filter/http-exception.filter';
import { ApiResult } from '@core/response/api-result';

@Controller('users')
@UseGuards(JwtAuthGuard, PoliciesGuard)
@SerializeOptions({
  excludePrefixes: ['password'],
})
@UseInterceptors(UserSerialize)
@UseFilters(HttpExceptionFilter)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @CheckPolicies((ability) => ability.can(Action.Read, 'all'))
  async fetch() {
    const users = await this.userService.findAll();
    return ApiResult.success(users, 'Users retrieved successfully');
  }

  @Get('/me')
  @CheckPolicies((ability, req) => ability.can(Action.Read, req.user))
  async findOne(@Req() req: Request & { user: any }) {
    const user = await this.userService.findById(req.user.id);
    return ApiResult.success(user, 'User retrieved successfully');
  }

  @Patch('/me')
  @CheckPolicies((ability, req) => ability.can(Action.Update, req.user))
  async update(
    @Req() req: Request & { user: any },
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const user = await this.userService.update(req.user.id, updateUserDto);
    return ApiResult.success(user, 'User updated successfully');
  }

  @Delete('/me')
  @CheckPolicies((ability, req) => ability.can(Action.Delete, req.user))
  async delete(@Req() req: Request & { user: any }) {
    const user = await this.userService.delete(req.user.id);
    return ApiResult.success(user, 'User deleted successfully');
  }
}
```

(The `/me` routes now read the authenticated user from `req.user.id`, populated by `JwtAuthGuard`, instead of `req['userId']`, populated by the separate `JwtMiddleware`. `JwtMiddleware` still runs — it's untouched — but these three handlers no longer read its output, since `PoliciesGuard` already requires `req.user` to be populated for the ability check, so sourcing the id from the same place keeps the controller internally consistent. `req['userId']` is not read anywhere else in this file.)

- [ ] **Step 2: Modify `src/api/user/user.module.ts`**

Current (after Task 4's edit):
```typescript
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { User } from './entities/user.entity';
import { JwtMiddleware } from '@/core/middlewares/jwt.middleware';
import { JwtService } from '@nestjs/jwt';
import { JwtStrategy } from '@/api/auth/strategies/jwt';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RoleModule } from '@api/role/role.module';

@Module({
  imports: [MikroOrmModule.forFeature([User]), RoleModule],
  controllers: [UserController],
  providers: [UserService, JwtService, JwtStrategy],
  exports: [UserService],
})
export class UserModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(JwtMiddleware).forRoutes(UserController);
  }
}
```

Replace with:
```typescript
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { User } from './entities/user.entity';
import { JwtMiddleware } from '@/core/middlewares/jwt.middleware';
import { JwtService } from '@nestjs/jwt';
import { JwtStrategy } from '@/api/auth/strategies/jwt';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RoleModule } from '@api/role/role.module';
import { CaslModule } from '@core/casl/casl.module';

@Module({
  imports: [MikroOrmModule.forFeature([User]), RoleModule, CaslModule],
  controllers: [UserController],
  providers: [UserService, JwtService, JwtStrategy],
  exports: [UserService],
})
export class UserModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(JwtMiddleware).forRoutes(UserController);
  }
}
```

(`CaslModule` must be importable here so Nest's DI container can resolve `PoliciesGuard`'s `CaslAbilityFactory` dependency when `@UseGuards(PoliciesGuard)` instantiates it by class reference.)

- [ ] **Step 3: Type-check**

Run: `pnpm run build`
Expected: exit code 0, no TypeScript errors.

- [ ] **Step 4: Run full test suite**

Run: `pnpm run test`
Expected: all suites pass, including every spec added in Tasks 2, 4, 6, 7.

- [ ] **Step 5: Lint**

Run: `pnpm run lint`
Expected: exit code 0, no errors (auto-fixable issues are fixed in place by `--fix`; re-run `git diff` afterward to confirm nothing unexpected changed).

- [ ] **Step 6: Commit**

```bash
git add src/api/user/user.controller.ts src/api/user/user.module.ts
git commit -m "feat: enforce CASL policies on UserController routes"
```

---

### Task 9: Manual smoke test

**Files:** none (verification only).

**Interfaces:**
- Consumes: the full stack from Tasks 1–8.

- [ ] **Step 1: Ensure MongoDB is running and seeding is enabled**

Confirm `.env` has (or export inline):
```bash
DB_TYPE=mongodb
ENABLE_SEEDER=1
```

If MongoDB isn't already running:
```bash
docker-compose up -d
```

- [ ] **Step 2: Start the app**

```bash
pnpm run start:dev
```
Expected: logs show `RoleSeeder` output (`Created 2 new roles`, `Created 4 new permissions` on first run; `Created 0 new roles` / permissions skipped on subsequent runs), then Nest's normal `Nest application successfully started`.

- [ ] **Step 3: Sign up two users**

```bash
curl -s -X POST http://localhost:3000/auth/signIn \
  -H 'Content-Type: application/json' \
  -d '{"type":"local","user":{"username":"alice","password":"password123"}}'
curl -s -X POST http://localhost:3000/auth/signIn \
  -H 'Content-Type: application/json' \
  -d '{"type":"local","user":{"username":"bob","password":"password123"}}'
```
Expected: both return `200`/`201` with a user object (no `role` field visible if excluded by serialization, that's fine — verify success, not shape).

- [ ] **Step 4: Promote `alice` to admin directly in MongoDB**

```bash
docker exec -it <mongo-container-name> mongosh <database-name> --eval '
  const adminRole = db.roles.findOne({ name: "admin" });
  db.users.updateOne({ username: "alice" }, { $set: { role: adminRole._id } });
'
```
(Substitute the actual container/database name from `docker-compose.yml` / `.env`.)
Expected: `modifiedCount: 1`.

- [ ] **Step 5: Log in as both users**

```bash
ALICE_TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"type":"local","username":"alice","password":"password123"}' | jq -r '.data.accessToken')
BOB_TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"type":"local","username":"bob","password":"password123"}' | jq -r '.data.accessToken')
```
Expected: both non-empty JWT strings.

- [ ] **Step 6: Verify `GET /users` — admin allowed, regular user denied**

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/users -H "Authorization: Bearer $ALICE_TOKEN"
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/users -H "Authorization: Bearer $BOB_TOKEN"
```
Expected: `200` for alice (admin), `403` for bob (regular user).

- [ ] **Step 7: Verify `/users/me` works for both against their own record**

```bash
curl -s http://localhost:3000/users/me -H "Authorization: Bearer $ALICE_TOKEN"
curl -s http://localhost:3000/users/me -H "Authorization: Bearer $BOB_TOKEN"
```
Expected: both `200`, each returning their own `username` (`alice` / `bob`).

- [ ] **Step 8: Verify `PATCH` and `DELETE /users/me` for the regular user**

```bash
curl -s -X PATCH http://localhost:3000/users/me -H "Authorization: Bearer $BOB_TOKEN" \
  -H 'Content-Type: application/json' -d '{"username":"bob2"}'
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE http://localhost:3000/users/me -H "Authorization: Bearer $BOB_TOKEN"
```
Expected: `PATCH` returns `200` with `username: "bob2"`; `DELETE` returns `200`.

- [ ] **Step 9: Record the result**

No commit needed for this task — if any step fails, stop and fix the relevant task before proceeding (do not commit further work on top of a failing smoke test).

---

## Post-plan follow-ups (not part of this plan)

- Admin CRUD API for `Role`/`Permission` (out of scope per spec).
- Verifying against `DB_TYPE=postgresql` (no local compose service exists for it).
- Consolidating the `JwtAuthGuard`/`request.user` and `JwtMiddleware`/`req['userId']` duplication (pre-existing, unrelated to this feature).
