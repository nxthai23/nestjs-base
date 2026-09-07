// This test never goes through Nest's DI container (the service is
// constructed manually below), and role.service.ts -> entities/role.entity.ts
// -> entities/permission.entity.ts -> @core/base/base.entity.ts transitively
// pulls in the rest - see mikro-orm.mock.ts for why these need to be mocked.
// vi.mock() is hoisted above imports, so the shared factories are loaded via
// dynamic import inside each callback instead of referenced directly (which
// would hit a TDZ error since a static import wouldn't have run yet).
vi.mock('@mikro-orm/nestjs', () =>
  import('@libs/__test__/mikro-orm.mock').then((m) => m.mikroOrmNestjsMock()),
);
vi.mock('@mikro-orm/core', () =>
  import('@libs/__test__/mikro-orm.mock').then((m) => m.mikroOrmCoreMock()),
);
vi.mock('@mikro-orm/decorators/legacy', () =>
  import('@libs/__test__/mikro-orm.mock').then((m) =>
    m.mikroOrmDecoratorsLegacyMock(),
  ),
);
vi.mock('@mikro-orm/mongodb', () =>
  import('@libs/__test__/mikro-orm.mock').then((m) => m.mikroOrmMongodbMock()),
);

import type { Mock } from 'vitest';
import { RoleService } from '../role.service';

describe('RoleService', () => {
  function makeService(findOne: Mock) {
    const repository = {
      findOne,
      getEntityName: () => 'Role',
      getEntityManager: () => ({}),
    } as any;
    return new RoleService(repository);
  }

  it('findByName looks up a role by its name field', async () => {
    const findOne = vi.fn().mockResolvedValue({ id: 'role-1', name: 'admin' });
    const service = makeService(findOne);

    const result = await service.findByName('admin');

    expect(findOne).toHaveBeenCalledWith({ name: 'admin' });
    expect(result).toEqual({ id: 'role-1', name: 'admin' });
  });

  it('returns null when no role matches', async () => {
    const findOne = vi.fn().mockResolvedValue(null);
    const service = makeService(findOne);

    const result = await service.findByName('nonexistent');

    expect(result).toBeNull();
  });
});
