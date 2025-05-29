import { BeforeApplicationShutdown, Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements BeforeApplicationShutdown {
  @InjectRedis() private readonly redis: Redis;
  private logger: Logger = new Logger(this.constructor.name);

  async set(key, val, seconds: number) {
    this.logger.log(`Set redis: ${key}`);
    return this.redis.set(key, val, 'EX', seconds);
  }

  async setnx(key, val, seconds: number) {
    this.logger.log(`Setnx redis: ${key}`);
    return await this.redis.set(key, val, 'EX', seconds, 'NX');
  }

  async get(key): Promise<string> {
    this.logger.log(`Get from redis: ${key}`);
    return this.redis.get(key);
  }

  async del(key): Promise<number> {
    this.logger.log(`Delete from redis: ${key}`);
    return this.redis.del(key);
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    this.logger.log(`ZADD redis: ${key}`);
    return this.redis.zadd(key, score, member);
  }

  async zrange(
    key: string,
    start: number,
    stop: number,
    rev?: 'REV',
  ): Promise<string[]> {
    this.logger.log(`ZRANGE redis: ${key}`);
    return this.redis.zrange(key, start, stop, rev ? 'REV' : undefined);
  }

  async zcard(key: string): Promise<number> {
    this.logger.log(`ZCARD redis: ${key}`);
    return this.redis.zcard(key);
  }

  async zrem(key: string, ...members: string[]): Promise<number> {
    this.logger.log(`ZREM redis: ${key}`);
    return this.redis.zrem(key, ...members);
  }

  async zremrangebyrank(
    key: string,
    start: number,
    stop: number,
  ): Promise<number> {
    this.logger.log(`ZREMRANGEBYRANK redis: ${key}`);
    return this.redis.zremrangebyrank(key, start, stop);
  }

  async expire(key: string, seconds: number): Promise<number> {
    this.logger.log(`EXPIRE redis: ${key}`);
    return this.redis.expire(key, seconds);
  }

  async pipeline() {
    return this.redis.pipeline();
  }

  beforeApplicationShutdown() {
    this.redis?.disconnect();
  }
}
