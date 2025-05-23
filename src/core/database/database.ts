import { Injectable } from '@nestjs/common';
import {
  MikroOrmModuleOptions,
  MikroOrmOptionsFactory,
} from '@mikro-orm/nestjs';
import { LoadStrategy } from '@mikro-orm/core';
import { MongoDriver } from '@mikro-orm/mongodb';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { join } from 'path';

@Injectable()
export class DatabaseConfig implements MikroOrmOptionsFactory {
  createMikroOrmOptions(): MikroOrmModuleOptions {
    const dbType = process.env.DB_TYPE || 'mongodb';

    const baseOptions = {
      cache: { enabled: false },
      loadStrategy: LoadStrategy.JOINED,
      debug: process.env.NODE_ENV !== 'production',
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
        clientUrl: process.env.MONGO_URI || 'mongodb://localhost:27017',
        dbName: process.env.MONGO_DB_NAME || 'nestjs-base',
      };
    } else {
      return {
        ...baseOptions,
        driver: PostgreSqlDriver,
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || 'postgres',
        dbName: process.env.POSTGRES_DB_NAME || 'nestjs-base',
      };
    }
  }
}
