import { Injectable } from '@nestjs/common';
import {
  MikroOrmModuleOptions,
  MikroOrmOptionsFactory,
} from '@mikro-orm/nestjs';
import { LoadStrategy } from '@mikro-orm/core';
import { MongoDriver } from '@mikro-orm/mongodb';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DatabaseConfig implements MikroOrmOptionsFactory {
  constructor(private configService: ConfigService) {}

  createMikroOrmOptions(): MikroOrmModuleOptions {
    const dbType = this.configService.getOrThrow<string>('dbType');
    const nodeEnv = this.configService.getOrThrow<string>('NODE_ENV');

    const baseOptions = {
      cache: { enabled: false },
      loadStrategy: LoadStrategy.JOINED,
      debug: nodeEnv !== 'production',
      entities: ['dist/api/**/*.entity.js'],
      entitiesTs: ['src/api/**/*.entity.ts'],
      migrations: {
        path: join(process.cwd(), 'dist', 'migrations'),
        pathTs: join(process.cwd(), 'src', 'migrations'),
      },
    };

    if (dbType === 'mongodb') {
      return {
        ...baseOptions,
        driver: MongoDriver,
        clientUrl:
          this.configService.get<string>('mongoUri') ||
          'mongodb://localhost:27017',
        dbName: this.configService.get<string>('mongoDbName') || 'nestjs-base',
      };
    } else {
      return {
        ...baseOptions,
        driver: PostgreSqlDriver,
        host: this.configService.get<string>('postgresHost') || 'localhost',
        port: this.configService.get<number>('postgresPort') || 5432,
        user: this.configService.get<string>('postgresUser') || 'postgres',
        password:
          this.configService.get<string>('postgresPassword') || 'postgres',
        dbName:
          this.configService.get<string>('postgresDbName') || 'nestjs-base',
      };
    }
  }
}
