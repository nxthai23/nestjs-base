import { AppConfig } from '@api/app-config/entities/app-config.entity';
import { Permission } from '@api/role/entities/permission.entity';
import { Role } from '@api/role/entities/role.entity';
import { User } from '@api/user/entities/user.entity';

/**
 * Every entity MikroORM should discover, listed rather than globbed.
 *
 * Globs (`dist/api/**\/entities/*.entity.js`) resolve against the working
 * directory and against whichever files a build happens to emit, so discovery
 * depended on how the process was started. Worse, running from sources meant
 * MikroORM `import()`ing raw `.ts` at runtime, which is why the e2e harness
 * needed a second TypeScript loader on top of the test runner's.
 *
 * An explicit list is resolved by the compiler instead: wrong path, wrong
 * name, deleted file all fail the build. `entities.spec.ts` covers the one
 * mistake a compiler cannot catch - adding an entity and not listing it here.
 */
export const ENTITIES = [AppConfig, Permission, Role, User];
