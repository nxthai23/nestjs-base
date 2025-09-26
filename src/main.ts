import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { HttpExceptionFilter } from './core/filter/http-exception.filter';
import { getMemoryUsage } from './utils/hardware.util';
import { ConfigService } from '@nestjs/config';

import * as dotenv from 'dotenv';

async function bootstrap() {
  // Reload environment variables
  dotenv.config({ override: true });
  const app = await NestFactory.create(AppModule);
  /**
   * define cors options then pass to options to function enableCors.
   * @see https://docs.nestjs.com/security/cors
   */

  //  const corsOptions: any = {
  //   origin: [],
  //   methods: ['GET', 'POST', 'PUT', 'DELETE']
  //  }
  //  * if no options => use default options

  app.enableCors();
  app.useGlobalFilters(new HttpExceptionFilter());
  //using global pipe - global validation

  // get config
  const configService = app.get(ConfigService);
  const port = configService.get<number>('appPort') || 3000; // Default to 3000 if PORT isn't set

  // setup swagger
  const swaggerConfig = {
    title: 'NestJS Boilerplate',
    description: 'NestJS Boilerplate API Documentation',
    version: '1.0',
    tag: 'NestJS Boilerplate',
  };
  const { Swagger } = await import('./core/docs/swagger');
  const swagger = new Swagger();
  swagger.setupSwagger(app, swaggerConfig);

  await app.listen(port);

  // Log memory usage
  const memoryUsage = getMemoryUsage();
  Logger.log('Bootstrap memory usage: \n', 'Bootstrap');
  Logger.log(memoryUsage, 'Bootstrap');
  Logger.log(`Server running on http://localhost:${port}`, 'Bootstrap');
}

bootstrap();
