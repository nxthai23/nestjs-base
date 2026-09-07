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

/** Class names declared as `export class X extends BaseEntity`. */
function declaredEntities(file: string): string[] {
  return [
    ...readFileSync(file, 'utf8').matchAll(
      /export class (\w+) extends BaseEntity/g,
    ),
  ].map(([, name]) => name);
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
