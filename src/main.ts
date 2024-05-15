import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filter/http-exception';
import { getMemoryUsage } from './libs/hardware';
import { Callback, Context, Handler } from 'aws-lambda';
import serverlessExpress from '@codegenie/serverless-express';

// async function bootstrap() {
//   const app = await NestFactory.create(AppModule);
//   /**
//    * define cors options then pass to options to function enableCors.
//    * @see https://docs.nestjs.com/security/cors
//    */

//   //  const corsOptions: any = {
//   //   origin: [],
//   //   methods: ['GET', 'POST', 'PUT', 'DELETE']
//   //  }
//   //  * if no options => use default options

//   app.enableCors();
//   app.useGlobalFilters(new HttpExceptionFilter());
//   //using global pipe - global validation
//   const appPort = app.get(ConfigService).get('appPort');
//   await app.listen(appPort);
//   const memoryUsage = getMemoryUsage();
//   Logger.log('Bootstrap memory usage: \n', 'Bootstrap');
//   Logger.log(memoryUsage, 'Bootstrap');
//   Logger.log(`Server running on http://localhost:${appPort}`, 'Bootstrap');
// }

// bootstrap();

// serverless bootstrap
let server: Handler;

async function bootstrapServerless() {
  const app = await NestFactory.create(AppModule);
  await app.init();
  console.log('App initialized');
  const expressApp = app.getHttpAdapter().getInstance();
  return serverlessExpress({ app: expressApp });
}

export const handler: Handler = async (
  event: any,
  context: Context,
  callback: Callback,
) => {
  server = server ?? (await bootstrapServerless());
  const memoryUsage = getMemoryUsage();
  Logger.log('Bootstrap memory usage: \n', 'Bootstrap');
  Logger.log(memoryUsage, 'Bootstrap');
  return server(event, context, callback);
};
