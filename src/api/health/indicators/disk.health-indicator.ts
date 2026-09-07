import { Injectable } from '@nestjs/common';
import { statfsSync } from 'fs';
import { HealthIndicatorService } from '@nestjs/terminus';

const toGB = (bytes: number) =>
  Math.round((bytes / 1024 / 1024 / 1024) * 100) / 100;

@Injectable()
export class DiskHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  isHealthy(
    key: string,
    options: { path?: string; thresholdPercent?: number } = {},
  ) {
    const indicator = this.healthIndicatorService.check(key);
    const path = options.path ?? '/';
    const thresholdPercent = options.thresholdPercent ?? 0.9;

    try {
      const stats = statfsSync(path);
      const totalBytes = stats.blocks * stats.bsize;
      const freeBytes = stats.bfree * stats.bsize;
      const availableBytes = stats.bavail * stats.bsize;
      const usedBytes = totalBytes - freeBytes;
      const usedRatio = totalBytes > 0 ? usedBytes / totalBytes : 0;

      const data = {
        path,
        totalGB: toGB(totalBytes),
        usedGB: toGB(usedBytes),
        availableGB: toGB(availableBytes),
        usedPercent: Math.round(usedRatio * 10000) / 100,
        thresholdPercent: thresholdPercent * 100,
      };

      return usedRatio < thresholdPercent
        ? indicator.up(data)
        : indicator.down(data);
    } catch (err) {
      return indicator.down({ message: (err as Error).message });
    }
  }
}
