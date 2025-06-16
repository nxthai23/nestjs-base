import {
  EntityRepository,
  Populate,
  RequiredEntityData,
  wrap,
} from '@mikro-orm/core';
import { IBaseService } from './base.service.interface';
import { BaseEntity } from './base.entity';
import { NotFoundException } from '@nestjs/common';

/**
 * Base service class that implements common CRUD operations
 * @template T - The entity type (extends BaseEntity)
 * @template CreateDTO - The DTO type for creation
 * @template UpdateDTO - The DTO type for updates
 * @template IdType - The type of entity ID (string | ObjectId | number)
 */
export abstract class BaseService<T extends BaseEntity>
  implements IBaseService<T>
{
  protected entityName: string;

  constructor(private repository: EntityRepository<T>) {
    // Extract entity name from repository metadata
    this.entityName = this.repository.getEntityName();
  }
  /**
   * Read section
   */
  async findById<IdType>(
    id: IdType,
    populate?: Populate<T, string>,
  ): Promise<T | any> {
    return await this.repository.findOne(id, {
      populate,
    });
  }

  async findAll(populate?: Populate<T, string>): Promise<T[]> {
    return await this.repository.findAll({
      populate,
    });
  }

  async count(filter?: object): Promise<number> {
    return await this.repository.count(filter);
  }

  /**
   * Write section
   */

  async create(dto: RequiredEntityData<T>): Promise<Partial<T>> {
    const entity = this.repository.create(dto);
    const em = this.repository.getEntityManager();
    await em.persistAndFlush(entity);
    return entity;
  }

  async bulkCreate(dtos: RequiredEntityData<T>[]): Promise<boolean> {
    const entities = dtos.map((dto) => this.repository.create(dto));
    const em = this.repository.getEntityManager();
    await em.persistAndFlush(entities);
    return true;
  }

  async update<IdType>(id: IdType, dto: Partial<T>): Promise<Partial<T>> {
    const entity = await this.repository.findOne(id);
    if (!entity) {
      throw new NotFoundException(`${this.entityName} not found`);
    }
    wrap(entity).assign(dto as any);
    const em = this.repository.getEntityManager();
    await em.persistAndFlush(entity);
    return entity;
  }

  async delete<IdType>(id: IdType): Promise<Partial<T>> {
    const entity = await this.repository.findOne(id);
    if (!entity) {
      throw new NotFoundException(`${this.entityName} not found`);
    }
    const em = this.repository.getEntityManager();
    await em.removeAndFlush(entity);
    return entity;
  }
}
