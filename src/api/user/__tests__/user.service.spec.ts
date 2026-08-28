jest.mock('@mikro-orm/nestjs');
jest.mock('@mikro-orm/core');
jest.mock('@mikro-orm/decorators/legacy');
jest.mock('@mikro-orm/mongodb');

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
    const roleService = {
      findByName: jest.fn().mockResolvedValue(defaultRole),
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
    const roleService = { findByName: jest.fn().mockResolvedValue(null) };
    const service = makeUserService(roleService);

    await expect(
      service.createWithDefaultRole({ username: 'alice', password: 'hashed' }),
    ).rejects.toThrow(InternalServerErrorException);
  });
});
