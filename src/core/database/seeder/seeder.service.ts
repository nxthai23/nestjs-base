import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MikroORM } from '@mikro-orm/core';
import { ConfigService } from '@nestjs/config';
import { DatabaseSeeder } from './seeder';
import { RoleSeeder } from './scripts/role.seeder';

@Injectable()
export class SeederService implements OnModuleInit {
  constructor(
    private readonly orm: MikroORM,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.seed();
  }

  async seed() {
    const seeder = this.orm.seeder;

    // Roles/permissions are required for authorization to function at all,
    // so they must be seeded unconditionally (RoleSeeder is idempotent).
    // Optional reference/demo data below stays behind ENABLE_SEEDER.
    Logger.log('🔄 Ensuring default roles/permissions exist...', 'DatabaseSeeder');
    await seeder.seed(RoleSeeder);

    const isEnableSeeder = this.configService.get<number>('isEnableSeeder');
    Logger.log(`isEnableSeeder: ${isEnableSeeder}`, 'SeederService::seed');
    if (!isEnableSeeder) {
      Logger.log(
        '⚠️ Database seeder is disabled. Skipping optional seeding process.',
        'DatabaseSeeder',
      );
      return;
    }
    Logger.log('🔄 Running database seeder...', 'DatabaseSeeder');
    await seeder.seed(DatabaseSeeder);
    Logger.log('✅ Database seeding completed', 'DatabaseSeeder');
    return;
  }
}
