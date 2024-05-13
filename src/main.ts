import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filter/http-exception';

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
  const appPort = app.get(ConfigService).get('appPort');
  await app.listen(appPort);
  Logger.log(`Server running on http://localhost:${appPort}`, 'Bootstrap');
}

bootstrap();
