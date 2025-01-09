import { ClientSession } from 'mongoose';
import { BaseServiceInterface } from './base.interface.service';

export abstract class BaseServiceAbstract<T>
  implements BaseServiceInterface<T>
{
  constructor(private repository: any) {}

  async findOne<IdType>(id: IdType, populateOptions?: any): Promise<T> {
    try {
      return await this.repository.findOne(id, populateOptions);
    } catch (err) {
      throw new Error(err.message);
    }
  }

  async find(filter: object, populate?: any): Promise<T[]> {
    try {
      return await this.repository.find(filter, populate);
    } catch (err) {
      throw new Error(err.message);
    }
  }

  async findAll(populateOptions?: string): Promise<T[]> {
    try {
      return await this.repository.find({}, populateOptions);
    } catch (err) {
      throw new Error(err.message);
    }
  }

  async create(dto: Partial<T>, session?: ClientSession): Promise<T> {
    try {
      return await this.repository.create(dto, session);
    } catch (err) {
      throw new Error(err.message);
    }
  }

  async update(
    id: string,
    dto: Partial<T>,
    session?: ClientSession,
  ): Promise<T> {
    try {
      return await this.repository.update(id, dto, session);
    } catch (err) {
      throw new Error(err.message);
    }
  }

  async delete<IdType>(id: IdType, session?: ClientSession): Promise<boolean> {
    try {
      return await this.repository.delete(id, session);
    } catch (err) {
      throw new Error(err.message);
    }
  }
}
