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

    switch (dbType) {
      case 'mongodb':
        return {
          ...baseOptions,
          driver: MongoDriver,
          clientUrl:
            this.configService.get<string>('database.mongoUri') ||
            'mongodb://localhost:27017',
          dbName:
            this.configService.get<string>('database.mongoDbName') ||
            'nestjs-base',
        };
      case 'postgresql': {
        return {
          ...baseOptions,
          driver: PostgreSqlDriver,
          host:
            this.configService.get<string>('database.postgresHost') ||
            'localhost',
          port: this.configService.get<number>('database.postgresPort') || 5432,
          user:
            this.configService.get<string>('database.postgresUser') ||
            'postgres',
          password:
            this.configService.get<string>('database.postgresPassword') ||
            'postgres',
          dbName:
            this.configService.get<string>('database.postgresDbName') ||
            'nestjs-base',
        };
      }
      default: {
        throw new Error(
          `Unsupported database type: ${dbType}. Supported types are 'mongodb' and 'postgresql'.`,
        );
      }
    }
  }
}
