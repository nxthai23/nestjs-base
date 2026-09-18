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
 */
export abstract class BaseService<
  T extends BaseEntity,
> implements IBaseService<T> {
  protected entityName: string;

  constructor(private repository: EntityRepository<T>) {
    this.entityName = this.repository.getEntityName();
  }

  // The repository resolves the right per-request fork internally
  // (MikroORM RequestContext/AsyncLocalStorage), so this is safe to call
  // on every access instead of caching.
  protected get em(): EntityManager {
    return this.repository.getEntityManager();
  }

  /**
   * Manage section
   */
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

    // paginate=false leaves limit undefined; report the actual result size
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
   * Write section
   */

  async create(dto: RequiredEntityData<T>): Promise<T> {
    const entity = this.repository.create(dto);
    this.em.persist(entity);
    await this.em.flush();
    return entity;
  }

  async bulkCreate(dtos: RequiredEntityData<T>[]): Promise<boolean> {
    if (dtos.length === 0) {
      return true;
    }

    // Must be awaited: transactional() flushes and commits on its own,
    // so an unawaited call can resolve early and swallow errors.
    await this.em.transactional(async (em) => {
      const entities = dtos.map((dto) => this.repository.create(dto));
      entities.forEach((entity) => em.persist(entity));
    });
    return true;
  }

  async update<IdType>(id: IdType, dto: Partial<T>): Promise<T> {
    return await this.em.transactional(async (em) => {
      const entity = await this.repository.findOne(id);
      if (!entity) {
        throw new NotFoundException(`${this.entityName} not found`);
      }

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
   * Runs `fn` in a transaction: auto-commits on success, rolls back on
   * error. Works for PostgreSQL (native) and MongoDB (replica set required).
   */
  async withTransaction<R>(fn: (em: EntityManager) => Promise<R>): Promise<R> {
    return await this.em.transactional(async (em) => {
      return await fn(em as EntityManager);
    });
  }

  /**
   * Mixed section - raw aggregation/query.
   * MongoDB: Document[] pipeline. PostgreSQL: raw SQL string.
   */
  async aggregate<R = any>(query: object[] | string): Promise<R[]> {
    if (Array.isArray(query)) {
      const mongoEm = this.em as MongoEntityManager;
      return (await mongoEm.aggregate(
        this.entityName as unknown as EntityName<T>,
        query,
      )) as R[];
    }

    const conn = this.em.getConnection();
    return (await conn.execute(query)) as R[];
  }
}
