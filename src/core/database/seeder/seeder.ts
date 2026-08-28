import { EntityManager } from '@mikro-orm/core';
import { Seeder } from '@mikro-orm/seeder';
import { AppConfigSeeder } from './scripts/app-config.seeder';

// RoleSeeder is run unconditionally by SeederService since roles/permissions
// are required for authorization, not optional reference data.
export class DatabaseSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    return this.call(em, [
      AppConfigSeeder,
      // Add other seeders here
    ]);
  }
}
