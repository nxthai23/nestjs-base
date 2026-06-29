import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MikroORM } from '@mikro-orm/core';
import { ConfigService } from '@nestjs/config';
import { DatabaseSeeder } from './seeder';

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
    const isEnableSeeder = this.configService.get<number>('isEnableSeeder');
    Logger.log(`isEnableSeeder: ${isEnableSeeder}`, 'SeederService::seed');
    if (!isEnableSeeder) {
      Logger.log(
        '⚠️ Database seeder is disabled. Skipping seeding process.',
        'DatabaseSeeder',
      );
      return;
    }
    const seeder = this.orm.seeder;
    Logger.log('🔄 Running database seeder...', 'DatabaseSeeder');
    await seeder.seed(DatabaseSeeder);
    Logger.log('✅ Database seeding completed', 'DatabaseSeeder');
    return;
  }
}
