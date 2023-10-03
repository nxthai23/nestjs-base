import { BaseServiceInterface } from './base.interface.service';

export abstract class BaseServiceAbstract<T>
  implements BaseServiceInterface<T>
{
  constructor(private repository: any) {}

  async findOne(filter: object, populate?: string): Promise<T> {
    try {
      return await this.repository.findOne(filter, populate);
    } catch (err) {
      throw new Error(err.message);
    }
  }

  async find(filter: object, populate?: string): Promise<T[]> {
    try {
      return await this.repository.find(filter, populate);
    } catch (err) {
      throw new Error(err.message);
    }
  }

  async create(dto: Partial<T>): Promise<T> {
    try {
      return await this.repository.create(dto);
    } catch (err) {
      throw new Error(err.message);
    }
  }
  async update(id: string, dto: Partial<T>): Promise<T> {
    try {
      return await this.repository.update(id, dto);
    } catch (err) {
      throw new Error(err.message);
    }
  }
  async delete<IdType>(id: IdType): Promise<IdType> {
    try {
      return await this.repository.delete(id);
    } catch (err) {
      throw new Error(err.message);
    }
  }
  async fetch(): Promise<T[]> {
    try {
      return await this.repository.fetch();
    } catch (err) {
      throw new Error(err.message);
    }
  }
  async findOneById(id: string): Promise<T> {
    try {
      return await this.repository.findOne(id);
    } catch (err) {
      throw new Error(err.message);
    }
  }
}
