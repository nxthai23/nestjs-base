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

import { InternalServerErrorException } from '@nestjs/common';
import { UserService } from '../user.service';
import { RoleService } from '@api/role/role.service';

describe('UserService.createWithDefaultRole', () => {
  function makeUserService(roleService: Partial<RoleService>) {
    const repository = {
      getEntityName: () => 'User',
      getEntityManager: () => ({
        persist: vi.fn(),
        flush: vi.fn().mockResolvedValue(undefined),
      }),
      create: vi.fn((dto: any) => dto),
    } as any;
    return new UserService(repository, roleService as RoleService);
  }

  it('attaches the default "user" role when creating an account', async () => {
    const defaultRole = { id: 'role-user', name: 'user' };
    const roleService = {
      findByName: vi.fn().mockResolvedValue(defaultRole),
    };
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
    const roleService = { findByName: vi.fn().mockResolvedValue(null) };
    const service = makeUserService(roleService);

    await expect(
      service.createWithDefaultRole({ username: 'alice', password: 'hashed' }),
    ).rejects.toThrow(InternalServerErrorException);
  });
});
