import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { MikroOrmHealthIndicator } from './indicators/mikro-orm.health-indicator';
import { MemoryHealthIndicator } from './indicators/memory.health-indicator';
import { CacheHealthIndicator } from './indicators/cache.health-indicator';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [
    MikroOrmHealthIndicator,
    MemoryHealthIndicator,
    CacheHealthIndicator,
  ],
})
export class HealthModule {}
