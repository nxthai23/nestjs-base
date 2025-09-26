/**
 * Base service interface that defines common CRUD operations
 * @template T - The entity type
 * @template IdType - The type of entity ID (string | ObjectId | number)
 */

import { Populate, RequiredEntityData } from '@mikro-orm/core';

export interface Read<T> {
  findById<IdType>(id: IdType, populate: Populate<T, string>): Promise<T | any>;
  findAll(populate?: Populate<T, string>): Promise<T[]>;
  find(filter: object, populate?: Populate<T, string>): Promise<T[]>;
  count(filter?: object): Promise<number>;
}

export interface Write<T> {
  create(dto: RequiredEntityData<T>): Promise<Partial<T>>;
  bulkCreate(dtos: RequiredEntityData<T>[]): Promise<boolean>;
  update<IdType>(id: IdType, dto: Partial<T>): Promise<Partial<T>>;
  delete<IdType>(id: IdType): Promise<Partial<T>>;
  upsert<IdType>(
    id: IdType,
    dto: RequiredEntityData<T>,
  ): Promise<{ entity: Partial<T>; created: boolean }>;
}

export interface IBaseService<T> extends Read<T>, Write<T> {}
