import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';

const toMB = (bytes: number) => Math.round((bytes / 1024 / 1024) * 100) / 100;

@Injectable()
export class MemoryHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  isHealthy(
    key: string,
    options: { heapUsedThresholdMB?: number; rssThresholdMB?: number } = {},
  ) {
    const indicator = this.healthIndicatorService.check(key);
    const heapUsedThresholdMB = options.heapUsedThresholdMB ?? 150;
    const rssThresholdMB = options.rssThresholdMB ?? 300;

    const usage = process.memoryUsage();
    const data = {
      rssMB: toMB(usage.rss),
      heapTotalMB: toMB(usage.heapTotal),
      heapUsedMB: toMB(usage.heapUsed),
      externalMB: toMB(usage.external),
      heapUsedThresholdMB,
      rssThresholdMB,
    };

    const isHealthy =
      data.heapUsedMB < heapUsedThresholdMB && data.rssMB < rssThresholdMB;

    return isHealthy ? indicator.up(data) : indicator.down(data);
  }
}
