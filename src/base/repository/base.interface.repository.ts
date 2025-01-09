import { ClientSession } from 'mongoose';

export interface BaseRepositoryInterface<T> {
  findOne<IdType, T>(id: IdType, populateOptions?: any): Promise<T | any>;

  find(filterOptions: object, populateOptions?: any): Promise<T[] | any[]>;

  create(dto: Partial<T>, session?: ClientSession): Promise<Partial<T>>;

  update(
    id: string,
    dto: Partial<T>,
    session?: ClientSession,
  ): Promise<Partial<T>>;

  delete<IdType>(id: IdType, session?: ClientSession): Promise<boolean>;
}
