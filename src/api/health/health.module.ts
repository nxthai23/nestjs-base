import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { MikroOrmHealthIndicator } from './indicators/mikro-orm.health-indicator';
import { MemoryHealthIndicator } from './indicators/memory.health-indicator';
import { RedisHealthIndicator } from './indicators/redis.health-indicator';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [
    MikroOrmHealthIndicator,
    MemoryHealthIndicator,
    RedisHealthIndicator,
  ],
})
export class HealthModule {}
