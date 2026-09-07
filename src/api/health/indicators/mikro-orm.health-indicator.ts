import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { HealthIndicatorService } from '@nestjs/terminus';

@Injectable()
export class MikroOrmHealthIndicator {
  constructor(
    private readonly em: EntityManager,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy(key: string) {
    const indicator = this.healthIndicatorService.check(key);

    const result: { ok: boolean; reason?: string } = await this.em
      .getConnection()
      .checkConnection();
    if (!result.ok) {
      return indicator.down({
        message: result.reason ?? 'Database connection failed',
      });
    }

    return indicator.up();
  }
}
