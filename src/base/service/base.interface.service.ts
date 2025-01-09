import { ClientSession } from 'mongoose';

export interface Read<T> {
  findOne<IdType, T>(id: IdType, populateOptions?: any): Promise<T | any>;
  find(filter: object, populateOptions?: any): Promise<T[]>;
  findAll(populateOptions?: string): Promise<T[]>;
}

export interface Write<T> {
  create(dto: Partial<T>, session?: ClientSession): Promise<Partial<T>>;
  update(
    id: string,
    dto: Partial<T>,
    session?: ClientSession,
  ): Promise<Partial<T>>;
  delete<IdType>(id: IdType, session?: ClientSession): Promise<boolean>;
}

export interface BaseServiceInterface<T> extends Write<T>, Read<T> {}
