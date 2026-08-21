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
