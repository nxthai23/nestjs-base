import {
  Controller,
  Get,
  Header,
  HttpException,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { HealthCheckService } from '@nestjs/terminus';
import { ApiResult } from '@core/response/api-result';
import { MikroOrmHealthIndicator } from './indicators/mikro-orm.health-indicator';
import { MemoryHealthIndicator } from './indicators/memory.health-indicator';
import { CacheHealthIndicator } from './indicators/cache.health-indicator';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: MikroOrmHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly cache: CacheHealthIndicator,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  async check(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      const result = await this.health.check([
        () => this.db.isHealthy('database'),
        () => this.memory.isHealthy('memory'),
        () => this.cache.isHealthy('cache'),
      ]);

      return ApiResult.success(result, 'Health check passed');
    } catch (err) {
      if (err instanceof HttpException) {
        res.status(err.getStatus());
        return ApiResult.error(
          'Health check failed',
          err.getStatus(),
          req.url,
          err.getResponse(),
        );
      }

      throw err;
    }
  }
}
