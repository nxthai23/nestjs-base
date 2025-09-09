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
    console.log('isEnableSeeder', isEnableSeeder);
    if (!isEnableSeeder) {
      Logger.log('⚠️ Database seeder is disabled. Skipping seeding process.');
      return;
    }
    const seeder = this.orm.getSeeder();
    Logger.log('🔄 Running database seeder...');
    await seeder.seed(DatabaseSeeder);
    Logger.log('✅ Database seeding completed');
    return;
  }
}
