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

    const createdNewRoles = findCreateData<Pick<Role, 'name'>>(
      existingRoles,
      roleData,
      'name',
    );

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
