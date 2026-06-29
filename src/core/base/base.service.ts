import {
  EntityRepository,
  Populate,
  RequiredEntityData,
  wrap,
  EntityManager,
  EntityName,
} from '@mikro-orm/core';
import type { MongoEntityManager } from '@mikro-orm/mongodb';
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
export abstract class BaseService<
  T extends BaseEntity,
> implements IBaseService<T> {
  protected entityName: string;
  protected em: EntityManager;

  constructor(private repository: EntityRepository<T>) {
    // Extract entity name from repository metadata
    this.entityName = this.repository.getEntityName();
    // Cache EntityManager reference for better performance
    this.em = this.repository.getEntityManager();
  }
  /**
   * Manage section
   */
  getEntityManager(): EntityManager {
    return this.em;
  }

  getRepository(): EntityRepository<T> {
    return this.repository;
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

  async find(filter: object, populate?: Populate<T, string>): Promise<T[]> {
    return await this.repository.find(filter, {
      populate,
    });
  }

  async count(filter?: object): Promise<number> {
    return await this.repository.count(filter);
  }

  /**
   * Write section - Optimized for better performance
   */

  async create(dto: RequiredEntityData<T>): Promise<Partial<T>> {
    const entity = this.repository.create(dto);
    // Use cached EntityManager and persist without immediate flush for better performance
    this.em.persist(entity);
    await this.em.flush();
    return entity;
  }

  async bulkCreate(dtos: RequiredEntityData<T>[]): Promise<boolean> {
    if (dtos.length === 0) {
      return true;
    }

    // Use transaction for bulk operations to ensure atomicity and better performance
    this.em.transactional(async (em) => {
      const entities = dtos.map((dto) => this.repository.create(dto));
      // Persist all entities in memory first
      entities.forEach((entity) => em.persist(entity));
    });
    // Single flush operation for all entities
    await this.em.flush();
    return true;
  }

  async update<IdType>(id: IdType, dto: Partial<T>): Promise<Partial<T>> {
    return await this.em.transactional(async (em) => {
      // Use reference for better performance if we don't need the full entity
      const entity = await this.repository.findOne(id);
      if (!entity) {
        throw new NotFoundException(`${this.entityName} not found`);
      }

      // Assign new values using wrap for change tracking
      wrap(entity).assign(dto as any);
      await em.flush();
      return entity as Partial<T>;
    });
  }

  async delete<IdType>(id: IdType): Promise<Partial<T>> {
    return await this.em.transactional(async (em) => {
      const entity = await this.repository.findOne(id);
      if (!entity) {
        throw new NotFoundException(`${this.entityName} not found`);
      }

      em.remove(entity);
      await em.flush();
      return entity as Partial<T>;
    });
  }

  async upsert<IdType>(
    id: IdType,
    dto: RequiredEntityData<T>,
  ): Promise<{ entity: Partial<T>; created: boolean }> {
    return await this.em.transactional(async (em) => {
      const existingEntity = await this.repository.findOne(id);
      let entity: T;
      let created = false;

      if (!existingEntity) {
        entity = this.repository.create(dto);
        em.persist(entity);
        created = true;
      } else {
        wrap(existingEntity).assign(dto as any);
        entity = existingEntity;
      }

      await em.flush();
      return { entity: entity as Partial<T>, created };
    });
  }

  /**
   * Execute a callback within a transaction.
   * All EM operations inside `fn` are scoped to the same transaction.
   * Auto-commits on success, auto-rollbacks on error.
   * Works for both PostgreSQL (native) and MongoDB (replica set required).
   *
   * @example
   * ```ts
   * const result = await this.withTransaction(async (tx) => {
   *   const user = await tx.findOne(User, userId);
   *   user.balance -= amount;
   *   await tx.flush();
   *
   *   const invoice = tx.create(Invoice, { ... });
   *   tx.persist(invoice);
   *   await tx.flush();
   *
   *   return invoice;
   * });
   * ```
   */
  async withTransaction<R>(fn: (em: EntityManager) => Promise<R>): Promise<R> {
    return await this.em.transactional(async (em) => {
      // Use the forked EM for all operations within the callback
      return await fn(em as EntityManager);
    });
  }

  /**
   * Mixed section - Raw aggregation/query for MongoDB and PostgreSQL
   *
   * MongoDB: pass a Document[] pipeline. Include $limit, $facet, etc. in pipeline.
   * PostgreSQL: pass a raw SQL string. Include LIMIT, OFFSET in the query.
   */
  async aggregate<R = any>(query: object[] | string): Promise<R[]> {
    // MongoDB pipeline (array of stages)
    if (Array.isArray(query)) {
      const mongoEm = this.em as MongoEntityManager;
      return (await mongoEm.aggregate(
        this.entityName as unknown as EntityName<T>,
        query,
      )) as R[];
    }

    // PostgreSQL raw SQL
    const conn = this.em.getConnection();
    return (await conn.execute(query)) as R[];
  }
}
