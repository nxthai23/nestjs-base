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
and [casl.js.org/v7](https://casl.js.org/v7/en/guide/intro/), enforced
through a single unified ability-based guard that covers both admin-only
route gating and per-record ownership checks.

**Roles and permissions are stored in the database**, not hardcoded enums —
seeded with a default `admin`/`user` setup, but structured so new roles or
permissions can be added later by inserting rows, without a code change.

## Data model

### `Permission` (`src/api/role/entities/permission.entity.ts`)

One row = one CASL rule.

```ts
@Entity({ collection: 'permissions' })
export class Permission extends BaseEntity {
  @PrimaryKey() _id!: ObjectId;

  @Property() action!: string;     // e.g. 'manage' | 'read' | 'update' | 'delete'
  @Property() subject!: string;    // e.g. 'all' | 'User'

  @Property({ type: 'json', nullable: true })
  conditions?: Record<string, unknown>;

  @Property({ nullable: true })
  inverted?: boolean;              // true => a `cannot()` rule

  @ManyToOne(() => Role)
  role!: Role;

  constructor(partial: Partial<Permission>) { super(); Object.assign(this, partial); }
}
```

`action`/`subject` are free-form strings, not enums — a new action or
subject just means a new row, no redeploy. `conditions` mirrors CASL's
`RawRule.conditions` shape directly, so rows translate to rules with no
transformation beyond variable interpolation (below).

### `Role` (`src/api/role/entities/role.entity.ts`)

```ts
@Entity({ collection: 'roles' })
export class Role extends BaseEntity {
  @PrimaryKey() _id!: ObjectId;

  @Property({ unique: true })
  name!: string;                   // e.g. 'admin', 'user'

  @OneToMany(() => Permission, (permission) => permission.role)
  permissions = new Collection<Permission>(this);

  constructor(partial: Partial<Role>) { super(); Object.assign(this, partial); }
}
```

### `User` (updated)

```ts
@ManyToOne(() => Role)
role!: Role;
```

Replaces the enum field from the earlier draft of this spec. **One role per
user** (not many-to-many) — matches the admin/user example and keeps the
ability-building step simple (single role's permissions → rules, no
merging across multiple roles).

Every user must have a role; there is no nullable/default-less state. See
"Default role assignment" below for how this is satisfied without exposing
`role` on any DTO.

### `RoleService` (`src/api/role/role.service.ts`)

`RoleService extends BaseService<Role>`, adds `findByName(name: string): Promise<Role | null>`.

## Ownership conditions: variable interpolation

A DB-stored condition can't hold "the current user's id" as a literal value
— it has to be resolved per-request. Convention: any string value in
`conditions` starting with `$` is a placeholder for a field on the
requesting user, resolved when the ability is built.

`src/core/casl/interpolate-conditions.util.ts`:

```ts
export function interpolateConditions(
  conditions: Record<string, unknown>,
  user: User,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(conditions)) {
    result[key] =
      typeof value === 'string' && value.startsWith('$')
        ? (user as Record<string, unknown>)[value.slice(1)]
        : value;
  }
  return result;
}
```

Example: a `Permission` row `{ action: 'update', subject: 'User', conditions: { id: '$id' } }`
becomes, at ability-build time for a specific user, `{ id: '<that user's actual id>' }`
— i.e. "can update the `User` whose `id` equals my own `id`".

## CASL core (`src/core/casl/`)

### `action.enum.ts`

Kept as an enum **only** for the fixed set of CASL primitives
(`manage`/`create`/`read`/`update`/`delete`) used when writing
`@CheckPolicies()` handlers in code — this is CASL's own vocabulary, not
part of the customizable role/permission data. `Permission.action` in the
DB is a plain string and isn't required to be one of these (a seeded row
could use a custom action name); the enum just gives call sites autocomplete
for the common cases.

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
export type AppAbility = MongoAbility<[string, Subjects]>;

@Injectable()
export class CaslAbilityFactory {
  createForUser(user: User): AppAbility {
    const rules: RawRuleOf<AppAbility>[] = user.role.permissions
      .getItems()
      .map((permission) => ({
        action: permission.action,
        subject: permission.subject,
        conditions: permission.conditions
          ? interpolateConditions(permission.conditions, user)
          : undefined,
        inverted: permission.inverted ?? false,
      }));

    return createMongoAbility<AppAbility>(rules);
  }
}
```

`Action` here is typed `string` (not the `Action` enum) because rules are
data, not compile-time-known values — `@CheckPolicies()` call sites still
use the `Action` enum for the common cases, and TypeScript widens it to
`string` at the `ability.can(Action.Read, ...)` call site, which is fine
since `AppAbility`'s action type is `string`.

Requires `user.role.permissions` to already be populated (see below) —
this method does not query the DB itself, so it stays synchronous and
guard-friendly.

### `casl.module.ts`

`@Module({ providers: [CaslAbilityFactory], exports: [CaslAbilityFactory] })`.

## Populating `role.permissions` on the authenticated user

`JwtStrategy.validate()` currently does `UserService.findById(payload.sub)`.
It must now load the relation graph the ability factory needs:

```ts
UserService.findById(payload.sub, { populate: ['role', 'role.permissions'] })
```

(Exact option name/shape depends on `BaseService.findById`'s signature —
confirmed against `src/core/base/base.service.ts` during implementation;
MikroORM's underlying `populate` option is what's being threaded through.)

This keeps `CaslAbilityFactory.createForUser` synchronous, and means
`request.user` is always ability-ready by the time `PoliciesGuard` runs.

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
matching this repo's existing convention (no `APP_GUARD` global
registration exists today, so this doesn't introduce one). `JwtAuthGuard`
must run first to populate `request.user`.

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

- `GET /users` — only a role with a `manage`/`all` (or `read`/`all`)
  permission row passes; the seeded `user` role doesn't have one.
- `GET|PATCH|DELETE /users/me` — passes if the caller's role has a
  matching permission whose interpolated `conditions.id` equals their own
  id (the seeded `user` role), or unconditionally (the seeded `admin`
  role's `manage`/`all` row).

`UserModule` imports `CaslModule` so `PoliciesGuard` can inject
`CaslAbilityFactory`.

## Default role assignment (DTO fix, revised)

`CreateUserDto` still must not expose `role` — but now `role` is a required
relation, not an optional enum with a safe default, so **something** has to
assign it server-side on every create.

```ts
export class CreateUserDto extends PickType(User, ['username', 'password'] as const) {}
```

`UserService.create()` is overridden to resolve the default role when one
isn't already attached (internal callers, e.g. a future admin-create-user
path, could still pass one explicitly):

```ts
async create(data: Partial<User>): Promise<User> {
  if (!data.role) {
    const defaultRole = await this.roleService.findByName('user');
    if (!defaultRole) {
      throw new InternalServerErrorException('Default "user" role is not seeded');
    }
    data.role = defaultRole;
  }
  return super.create(data);
}
```

`UserModule` imports `RoleModule` (or has `RoleService` provided) so this
resolves. No endpoint in this change accepts `role` from a client — the
only way to grant `admin` is direct DB access or seeding.

## Seeding default roles/permissions

New seeder, following the existing `AppConfigSeeder` pattern
(`em.create`/`em.persist`, `findCreateData`/`findUpdateData` keyed on a
unique field):

`src/core/database/seeder/data/role.data.ts` — seed rows:

| role  | action   | subject | conditions      |
|-------|----------|---------|------------------|
| admin | manage   | all     | —                |
| user  | read     | User    | `{ id: '$id' }` |
| user  | update   | User    | `{ id: '$id' }` |
| user  | delete   | User    | `{ id: '$id' }` |

`src/core/database/seeder/scripts/role.seeder.ts` creates the `Role` rows
first (keyed on `name`), then creates/updates the associated `Permission`
rows tied to each role's id.

Registered in `seeder.ts`:

```ts
return this.call(em, [
  AppConfigSeeder,
  RoleSeeder,
  // Add other seeders here
]);
```

Must run (and be idempotent) before any user signs up, since
`UserService.create()` depends on the `user` role existing.

## Dependencies

`package.json`: add `@casl/ability`.

## Data flow

```
Request → JwtAuthGuard (authN, loads User with role+permissions populated)
        → PoliciesGuard (authZ)
              │
              ├─ CaslAbilityFactory.createForUser(request.user)
              │     → maps role.permissions rows to CASL rules,
              │       interpolating '$field' conditions against request.user
              │     → AppAbility
              └─ every @CheckPolicies handler run against (ability, request)
        → 403 ForbiddenException if any handler fails, else route handler runs
```

## Testing

- `src/core/casl/__tests__/interpolate-conditions.util.spec.ts` — `$field`
  substitution, literal values passed through untouched.
- `src/core/casl/__tests__/casl-ability.factory.spec.ts` — given a `User`
  fixture with a mocked `role.permissions` collection, verify the resulting
  ability grants/denies as expected for both an admin-shaped role
  (`manage`/`all`) and a user-shaped role (scoped `read`/`update`/`delete`
  on own `id`, denied on another user's id).
- `src/core/guard/__tests__/policies.guard.spec.ts` — allows when all
  handlers pass, throws `ForbiddenException` when any handler fails, using
  a mocked `ExecutionContext`.
- `src/api/user/__tests__/user.service.spec.ts` (new or extended) — `create()`
  attaches the default `user` role when none is provided; throws if the
  role isn't seeded.
- Manual smoke test (`DB_TYPE=mongodb`, the default, `ENABLE_SEEDER=1`):
  boot the app, confirm `admin`/`user` roles and their permission rows
  exist, sign up two users, manually reassign one to the `admin` role in
  Mongo, verify `GET /users` → 200 for admin / 403 for the regular user,
  and `/users/me` (`GET`/`PATCH`/`DELETE`) works for both against their own
  record.

## Out of scope

- No admin CRUD API for `Role`/`Permission` — extending roles/permissions
  in this pass means inserting/editing rows directly (or via the seeder
  data table). An admin-facing management API is a natural follow-up but
  adds real scope (validation of arbitrary `action`/`subject`/`conditions`
  input, audit logging, etc.) beyond an example RBAC setup.
- Multiple roles per user (many-to-many) — one role per user for now: it
  matches the admin/user example and keeps ability-building
  (single role → rules) simple. Moving to many-to-many later means merging
  rules across roles, which CASL supports (concatenate rule arrays) but
  isn't needed yet.
- Fixing the pre-existing duplicate JWT mechanism (`JwtAuthGuard` +
  `request.user` vs. the separate `JwtMiddleware` + `req['userId']` applied
  to `UserController`). Not touched here — `UserController` already has
  `@UseGuards(JwtAuthGuard)` at the class level, so `request.user` is
  reliably populated for `PoliciesGuard` regardless of the middleware. Left
  as a known inconsistency, unrelated to this feature.
- No verification against `DB_TYPE=postgresql` (no local compose service
  for it). `Role`/`Permission`/the `User.role` relation use standard
  MikroORM relation/JSON-property APIs (no enum), which should behave the
  same across drivers, but this isn't smoke-tested here.
- No global (`APP_GUARD`) registration of the new guards — kept
  per-controller, matching the existing pattern.
- No validation on `Permission.conditions`' shape beyond "valid JSON" —
  a malformed or nonsensical condition (e.g. referencing a field that
  doesn't exist on `User`) fails open to "no match" via CASL's normal rule
  evaluation, not a startup-time schema check.
