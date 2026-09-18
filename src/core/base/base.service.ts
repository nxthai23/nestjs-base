import {
  EntityRepository,
  Populate,
  RequiredEntityData,
  wrap,
  EntityManager,
  EntityName,
} from '@mikro-orm/core';
import type { MongoEntityManager } from '@mikro-orm/mongodb';
import { IBaseService, PaginationOptions } from './base.service.interface';
import { BaseEntity } from './base.entity';
import { NotFoundException } from '@nestjs/common';
import { Paginated } from '@core/response/api-result';
import { DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } from './base.constant';

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

  constructor(private repository: EntityRepository<T>) {
    // Extract entity name from repository metadata
    this.entityName = this.repository.getEntityName();
  }

  /**
   * Resolves to the fork MikroORM's RequestContext middleware created for
   * the current request (see AsyncLocalStorage in @mikro-orm/nestjs). Never
   * cache this in a field: services are singletons, so a cached fork would
   * be shared by every request instead of scoped to one.
   */
  protected get em(): EntityManager {
    return this.repository.getEntityManager();
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
    populate?: Populate<T, any>,
  ): Promise<T | any> {
    return await this.repository.findOne(id, {
      populate: populate,
    });
  }

  async find(
    filter: object = {},
    options?: PaginationOptions<T>,
    paginate = true,
  ): Promise<Paginated<T>> {
    const page = paginate
      ? Math.max(Number(options?.page ?? DEFAULT_PAGE), 1)
      : 1;
    const limit = paginate
      ? Math.min(
          Math.max(Number(options?.limit ?? DEFAULT_LIMIT), 1),
          MAX_LIMIT,
        )
      : undefined;
    const offset = paginate ? (page - 1) * (limit as number) : undefined;

    const [items, total] = await this.repository.findAndCount(filter, {
      limit,
      offset,
      populate: options?.populate,
    });

    // meta.limit must be a number; when paginate is false, limit is
    // undefined (no cap was applied), so report the actual result size.
    const metaLimit = limit ?? total;
    return {
      items,
      meta: {
        page,
        limit: metaLimit,
        total,
        totalPages: metaLimit > 0 ? Math.ceil(total / metaLimit) : 0,
      },
    };
  }

  async findAll(
    options?: PaginationOptions<T>,
    paginate = true,
  ): Promise<Paginated<T>> {
    return this.find({}, options, paginate);
  }

  async count(filter?: object): Promise<number> {
    return await this.repository.count(filter);
  }

  /**
   * Write section - Optimized for better performance
   */

  async create(dto: RequiredEntityData<T>): Promise<T> {
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

  async update<IdType>(id: IdType, dto: Partial<T>): Promise<T> {
    return await this.em.transactional(async (em) => {
      // Use reference for better performance if we don't need the full entity
      const entity = await this.repository.findOne(id);
      if (!entity) {
        throw new NotFoundException(`${this.entityName} not found`);
      }

      // Assign new values using wrap for change tracking
      wrap(entity).assign(dto as any);
      await em.flush();
      return entity;
    });
  }

  async delete<IdType>(id: IdType): Promise<T> {
    return await this.em.transactional(async (em) => {
      const entity = await this.repository.findOne(id);
      if (!entity) {
        throw new NotFoundException(`${this.entityName} not found`);
      }

      em.remove(entity);
      await em.flush();
      return entity;
    });
  }

  async upsert<IdType>(
    id: IdType,
    dto: RequiredEntityData<T>,
  ): Promise<{ entity: T; created: boolean }> {
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
      return { entity, created };
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
