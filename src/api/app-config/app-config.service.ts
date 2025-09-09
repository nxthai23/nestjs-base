import { Injectable, NotFoundException } from '@nestjs/common';
import { BaseService } from '@core/base/base.service';
import { AppConfig } from '@api/app-config/entities/app-config.entity';
import { EntityRepository } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';

@Injectable()
export class AppConfigService extends BaseService<AppConfig> {
  constructor(
    @InjectRepository(AppConfig)
    private readonly appConfigRepository: EntityRepository<AppConfig>,
  ) {
    super(appConfigRepository);
  }

  async findAllActivePublicConfigs(): Promise<AppConfig[]> {
    return this.appConfigRepository.find({ isActive: true, isPublic: true });
  }

  async getConfigByKey<T>(key: string): Promise<T> {
    const config = await this.appConfigRepository.findOne({ key });
    if (!config) {
      throw new NotFoundException(`Config with key ${key} not found`);
    }
    return config.value as T;
  }

  async setConfig<T>(
    key: string,
    value: T,
    description?: string,
  ): Promise<AppConfig> {
    return this.appConfigRepository
      .getEntityManager()
      .transactional(async (em) => {
        let config = await em.findOne(AppConfig, { key });

        if (config) {
          config.value = value;
          config.description = description;
        } else {
          config = em.create(AppConfig, {
            key,
            value,
            description,
          });
          em.persist(config);
        }
        return config;
      });
  }
}
