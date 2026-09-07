import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Boots the real AppModule against the real database, so this covers what unit
 * tests cannot: that every module actually wires together and the router
 * serves what the controllers declare.
 *
 * Needs the services from docker-compose to be up.
 */
describe('AppModule (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('serves the health check', async () => {
    const response = await request(app.getHttpServer()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: 'Health check passed',
      data: { status: 'ok' },
    });
  });

  it('reports the cache driver it booted with', async () => {
    const response = await request(app.getHttpServer()).get('/health');

    expect(response.body.data.details.cache).toMatchObject({ status: 'up' });
  });

  it('404s a route no controller declares', async () => {
    await request(app.getHttpServer()).get('/').expect(404);
  });
});
