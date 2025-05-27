import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { HttpExceptionFilter } from './core/filter/http-exception.filter';
import { getMemoryUsage } from './libs/hardware';

async function bootstrap() {
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

  const appPort = app.get(ConfigService).get('appPort');
  await app.listen(appPort);

  // Log memory usage
  const memoryUsage = getMemoryUsage();
  Logger.log('Bootstrap memory usage: \n', 'Bootstrap');
  Logger.log(memoryUsage, 'Bootstrap');
  Logger.log(`Server running on http://localhost:${appPort}`, 'Bootstrap');
}

bootstrap();
