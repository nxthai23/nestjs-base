import { Test, TestingModule } from '@nestjs/testing';
import { ApplicationConfig } from '@nestjs/core';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // nestjs-pino v5's (`@Global()`) LoggerModule injects ApplicationConfig
      // directly, which Test.createTestingModule() never binds the way
      // NestFactory.create() does - the app itself boots fine. Confirmed
      // via logging (see PR/commit notes) that this useMocker fallback
      // still doesn't match: under `NODE_OPTIONS=--import=tsx` (required so
      // MikroORM can dynamically import raw .entity.ts files), Node's
      // native ESM loader and Vite/vitest's own SSR module runner each end
      // up with their own instance of @nestjs/core, so `ApplicationConfig`
      // here !== the one nestjs-pino's LoggerModule compares against. This
      // is a module-loader-identity conflict between tsx and Vite's SSR
      // runtime, not an application bug - left as a known limitation of
      // this e2e harness rather than chasing a 3-way loader conflict for a
      // single untouched boilerplate test (not part of CI).
      .useMocker((token) =>
        token === ApplicationConfig ? new ApplicationConfig() : undefined,
      )
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });
});
