import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { HttpExceptionFilter } from './core/filter/http-exception.filter';
import { getMemoryUsage } from './utils/hardware.util';
import { ConfigService } from '@nestjs/config';

import * as dotenv from 'dotenv';

async function bootstrap() {
  // Reload environment variables
  dotenv.config({ override: true });
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true, // Buffer logs until logger is ready
  });
  /**
   * define cors options then pass to options to function enableCors.
   * @see https://docs.nestjs.com/security/cors
   */

  // logging (pino)
  const logger = app.get(Logger);
  app.useLogger(logger);
  app.flushLogs();

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

  // Without this, SIGTERM kills the process outright and no provider's
  // beforeApplicationShutdown runs - cache connections would be dropped
  // rather than closed on every rolling restart.
  app.enableShutdownHooks();

  await app.listen(port);

  // Log memory usage
  const memoryUsage = getMemoryUsage();
  logger.log(
    `Bootstrap Memory → RSS: ${memoryUsage.rss.split(' -> ')[0]} | Heap: ${
      memoryUsage.heapUsed.split(' -> ')[0]
    }/${memoryUsage.heapTotal.split(' -> ')[0]} | External: ${
      memoryUsage.external.split(' -> ')[0]
    }`,
    'App',
  );
  logger.log({
    msg: `Server running on http://localhost:${port}`,
    context: 'App',
  });
}

bootstrap();
