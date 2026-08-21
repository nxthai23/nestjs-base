# CASL-based RBAC for User — Design Spec

Date: 2026-08-21

## Purpose

There is no authorization layer in this repo today — only authentication
(`JwtAuthGuard`, populating `request.user`). `UserController` has a literal
`// @TODO: add admin validation later for this controller` marking where
role-based access was meant to go. `User` has no `role` field, and no
guard/decorator anywhere checks roles or permissions.

This adds an example RBAC implementation for the `User` resource, using
CASL (`@casl/ability`) per
[docs.nestjs.com/security/authorization](https://docs.nestjs.com/security/authorization)
and [casl.js.org/v7](https://casl.js.org/v7/en/guide/intro/): two roles
(`admin`, `user`), enforced through a single unified ability-based guard that
covers both admin-only route gating and per-record ownership checks (no
separate `@Roles()`/`RolesGuard` system alongside it).

## Role storage

`src/api/user/enums/user-role.enum.ts`:

```ts
export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}
```

`User` entity (`src/api/user/entities/user.entity.ts`) gains:

```ts
@Enum(() => UserRole)
role: UserRole = UserRole.USER;
```

Every new user defaults to `USER`. There is no public path to set `role` to
`ADMIN` (see DTO fix below) — granting admin requires direct DB/seeder
access.

**Caveat**: this repo supports both `DB_TYPE=mongodb` and `DB_TYPE=postgresql`,
but has no existing entity with an `@Enum()` field and no docker-compose
service for Postgres, so there's no way to smoke-test the Postgres path
locally. The field is declared using MikroORM's standard dual-driver
`@Enum()` API, but only the Mongo path (the default, backed by the existing
compose file) will actually be verified as part of this work.

## CASL core (`src/core/casl/`)

### `action.enum.ts`

```ts
export enum Action {
  Manage = 'manage',
  Create = 'create',
  Read = 'read',
  Update = 'update',
  Delete = 'delete',
}
```

### `casl-ability.factory.ts`

```ts
type Subjects = InferSubjects<typeof User> | 'all';
export type AppAbility = MongoAbility<[Action, Subjects]>;

@Injectable()
export class CaslAbilityFactory {
  createForUser(user: User): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    if (user.role === UserRole.ADMIN) {
      can(Action.Manage, 'all');
    } else {
      can([Action.Read, Action.Update, Action.Delete], User, { id: user.id });
    }

    return build();
  }
}
```

Regular users can only `Read`/`Update`/`Delete` the `User` record whose `id`
matches their own — CASL's condition matching handles the ownership check,
since `request.user` is always a real `User` entity instance.

### `casl.module.ts`

A small `@Module({ providers: [CaslAbilityFactory], exports: [CaslAbilityFactory] })`
so the factory is injectable into `PoliciesGuard` (and any future consumer).

## Guard + decorator

### `src/core/decorators/check-policies.decorator.ts`

```ts
export type PolicyHandlerCallback = (ability: AppAbility, request: any) => boolean;
export const CHECK_POLICIES_KEY = 'check_policies';
export const CheckPolicies = (...handlers: PolicyHandlerCallback[]) =>
  SetMetadata(CHECK_POLICIES_KEY, handlers);
```

Handlers take `(ability, request)` — not just `ability` — so ownership
checks against `request.user` (e.g. the `/users/me` routes) don't need a
separate resource lookup.

### `src/core/guard/policies.guard.ts`

```ts
@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private caslAbilityFactory: CaslAbilityFactory,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const handlers =
      this.reflector.get<PolicyHandlerCallback[]>(CHECK_POLICIES_KEY, context.getHandler()) ?? [];
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

Applied per-controller as `@UseGuards(JwtAuthGuard, PoliciesGuard)` —
matching this repo's existing convention (no `APP_GUARD` global registration
exists today, so this doesn't introduce one). `JwtAuthGuard` must run first
to populate `request.user`.

## Route wiring in `UserController`

Replaces the `// @TODO: add admin validation later for this controller`
comment:

```ts
@Get()
@CheckPolicies((ability) => ability.can(Action.Read, 'all'))
findAll() { ... }

@Get('me')
@CheckPolicies((ability, req) => ability.can(Action.Read, req.user))
findMe() { ... }

@Patch('me')
@CheckPolicies((ability, req) => ability.can(Action.Update, req.user))
updateMe() { ... }

@Delete('me')
@CheckPolicies((ability, req) => ability.can(Action.Delete, req.user))
deleteMe() { ... }
```

- `GET /users` — admin only (only an admin's ability has `can(Read, 'all')`).
- `GET|PATCH|DELETE /users/me` — self or admin.

`UserModule` imports `CaslModule` so `PoliciesGuard` can inject
`CaslAbilityFactory`.

## DTO fix (privilege-escalation guard)

`CreateUserDto` currently does `extends PartialType(User)`, which would
expose `role` as a settable field the moment it's added to the entity —
letting anyone self-assign `admin` via `POST /auth/signIn`. Fix:

```ts
export class CreateUserDto extends PickType(User, ['username', 'password'] as const) {}
```

`UpdateUserDto extends PartialType(CreateUserDto)` automatically inherits
the exclusion, so `PATCH /users/me` can't self-escalate either. `role` can
only be set via the entity's default (`USER`) or direct DB/seeder access —
no endpoint in this change grants admin.

## Dependencies

`package.json`: add `@casl/ability`.

## Data flow

```
Request → JwtAuthGuard (authN, sets request.user)
        → PoliciesGuard (authZ)
              │
              ├─ CaslAbilityFactory.createForUser(request.user) → AppAbility
              └─ every @CheckPolicies handler run against (ability, request)
        → 403 ForbiddenException if any handler fails, else route handler runs
```

## Testing

- `src/core/casl/__tests__/casl-ability.factory.spec.ts` — admin ability
  shape (`can(Manage, 'all')`) vs. regular-user ability shape (scoped
  `Read`/`Update`/`Delete` on own `id` only, denied on another user's id).
- `src/core/guard/__tests__/policies.guard.spec.ts` — allows when all
  handlers pass, throws `ForbiddenException` when any handler fails, using a
  mocked `ExecutionContext`.
- Manual smoke test (`DB_TYPE=mongodb`, the default): sign up two users,
  promote one to `admin` directly in Mongo, verify `GET /users` → 200 for
  admin / 403 for the regular user, and `/users/me` (`GET`/`PATCH`/`DELETE`)
  works for both against their own record.

## Out of scope

- Fixing the pre-existing duplicate JWT mechanism (`JwtAuthGuard` +
  `request.user` vs. the separate `JwtMiddleware` + `req['userId']` applied
  to `UserController`). Not touched here — `UserController` already has
  `@UseGuards(JwtAuthGuard)` at the class level, so `request.user` is
  reliably populated for `PoliciesGuard` regardless of the middleware. Left
  as a known inconsistency, unrelated to this feature.
- No admin-only endpoint to promote/demote a user's role — out of scope for
  this example; role changes are DB/seeder-only for now.
- No verification against `DB_TYPE=postgresql` (no local compose service for
  it).
- No global (`APP_GUARD`) registration of the new guards — kept
  per-controller, matching the existing pattern.
