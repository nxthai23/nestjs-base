// filepath: /Users/thainx/Desktop/code_base/nestjs-base/src/core/base/base.service.ts
import { EntityRepository, FilterQuery, wrap } from '@mikro-orm/core';
import { ObjectId } from '@mikro-orm/mongodb';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseEntity } from '../database/entities/base.entity';
import { IBaseService } from './base.service.interface';

/**
 * Base service class that implements common CRUD operations
 * @template T - The entity type (extends BaseEntity)
 * @template CreateDTO - The DTO type for creation
 * @template UpdateDTO - The DTO type for updates
 * @template IdType - The type of entity ID (string | ObjectId | number)
 */
export abstract class BaseService<
  T extends BaseEntity,
  CreateDTO,
  UpdateDTO,
  IdType = string | ObjectId | number,
> implements IBaseService<T, CreateDTO, UpdateDTO, IdType>
{
  constructor(
    protected readonly repository: EntityRepository<T>,
    protected readonly configService: ConfigService,
  ) {}

  /**
   * Find all entities with optional filtering and pagination
   * @param filter Optional filter criteria
   * @param page Optional page number for pagination
   * @param limit Optional limit of items per page
   * @returns Promise with array of entities
   */
  async findAll(
    filter?: Partial<T>,
    page?: number,
    limit?: number,
  ): Promise<T[]> {
    const options: any = {};

    if (page !== undefined && limit !== undefined) {
      options.offset = (page - 1) * limit;
      options.limit = limit;
    }

    return this.repository.find(filter as FilterQuery<T>, options);
  }

  /**
   * Find a single entity by ID
   * @param id The ID of the entity to find
   * @returns Promise with the found entity
   * @throws NotFoundException if entity is not found
   */
  async findById(id: IdType): Promise<T> {
    const entity = await this.repository.findOne({ id } as FilterQuery<T>);

    if (!entity) {
      throw new NotFoundException(`Entity with id ${id} not found`);
    }

    return entity;
  }

  /**
   * Find a single entity by criteria
   * @param filter The filter criteria
   * @returns Promise with the found entity
   * @throws NotFoundException if entity is not found
   */
  async findOne(filter: Partial<T>): Promise<T> {
    const entity = await this.repository.findOne(filter as FilterQuery<T>);

    if (!entity) {
      throw new NotFoundException('Entity not found');
    }

    return entity;
  }

  /**
   * Create a new entity
   * @param data The data to create the entity with
   * @returns Promise with the created entity
   */
  async create(data: CreateDTO): Promise<T> {
    const entity = this.repository.create(data as any);
    const em = this.repository.getEntityManager();
    await em.persistAndFlush(entity);
    return entity;
  }

  /**
   * Update an existing entity
   * @param id The ID of the entity to update
   * @param data The data to update the entity with
   * @returns Promise with the updated entity
   * @throws NotFoundException if entity is not found
   */
  async update(id: IdType, data: UpdateDTO): Promise<T> {
    const entity = await this.findById(id);
    const em = this.repository.getEntityManager();

    wrap(entity).assign(data as any);
    await em.flush();

    return entity;
  }

  /**
   * Delete an entity by ID
   * @param id The ID of the entity to delete
   * @returns Promise with boolean indicating success
   * @throws NotFoundException if entity is not found
   */
  async delete(id: IdType): Promise<boolean> {
    const entity = await this.findById(id);
    const em = this.repository.getEntityManager();

    em.remove(entity);
    await em.flush();

    return true;
  }
}
