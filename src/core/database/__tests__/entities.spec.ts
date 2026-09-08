import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { ENTITIES } from '../entities';

const API_DIR = join(process.cwd(), 'src', 'api');

function entityFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return entityFiles(path);
    return name.endsWith('.entity.ts') ? [path] : [];
  });
}

/**
 * Class names carrying an `@Entity(...)` decorator, allowing further
 * decorators between it and the declaration.
 */
export function entityNamesIn(source: string): string[] {
  return [
    ...source.matchAll(
      /@Entity\([^)]*\)\s*(?:@\w+\([^)]*\)\s*)*export\s+(?:abstract\s+)?class\s+(\w+)/g,
    ),
  ].map(([, name]) => name);
}

function declaredEntities(file: string): string[] {
  return entityNamesIn(readFileSync(file, 'utf8'));
}

/**
 * ENTITIES replaced a filesystem glob, which picked up new entity files on its
 * own. A list does not, so this is the guard: add an entity and forget to
 * register it, and this fails rather than a query failing at runtime.
 */
describe('ENTITIES', () => {
  it('registers every entity declared under src/api', () => {
    const declared = entityFiles(API_DIR).flatMap(declaredEntities).sort();
    const registered = ENTITIES.map((entity) => entity.name).sort();

    expect(declared).toEqual(registered);
  });

  it('finds entity files to check, so the walk itself cannot silently pass', () => {
    expect(entityFiles(API_DIR).length).toBeGreaterThan(0);
  });
});

/**
 * The guard is only as good as what it recognises as an entity. MikroORM marks
 * entities with `@Entity()`; extending BaseEntity is this repo's convention,
 * not a requirement — so anything keyed off the base class would miss an
 * entity *and* leave it out of ENTITIES, the exact pair of mistakes above.
 */
describe('entityNamesIn', () => {
  it('finds an entity that follows the repo convention', () => {
    expect(
      entityNamesIn(`
        @Entity({ collection: 'users' })
        export class User extends BaseEntity {}
      `),
    ).toEqual(['User']);
  });

  it('finds an entity that does not extend BaseEntity', () => {
    expect(
      entityNamesIn(`
        @Entity()
        export class AuditLog {
          @PrimaryKey()
          id!: string;
        }
      `),
    ).toEqual(['AuditLog']);
  });

  it('finds an entity carrying other decorators as well', () => {
    expect(
      entityNamesIn(`
        @Entity()
        @Filter({ name: 'active' })
        export class Session extends SomeOtherBase {}
      `),
    ).toEqual(['Session']);
  });

  it('ignores a class that is not an entity at all', () => {
    expect(
      entityNamesIn(`
        export class UserDto extends BaseDto {}
        export abstract class BaseEntity {}
      `),
    ).toEqual([]);
  });

  it('finds every entity when one file declares several', () => {
    expect(
      entityNamesIn(`
        @Entity()
        export class Role extends BaseEntity {}

        @Entity()
        export class Permission extends BaseEntity {}
      `),
    ).toEqual(['Role', 'Permission']);
  });
});
