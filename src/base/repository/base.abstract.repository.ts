import { Model } from 'mongoose';
import { BaseRepositoryInterface } from './base.interface.repository';

export abstract class BaseRepositoryAbstract<T>
  implements BaseRepositoryInterface<T>
{
  constructor(private model: Model<T>) {
    this.model = model;
  }

  async findOne<IdType, T>(
    id: IdType,
    populateOptions?: string,
  ): Promise<T | any> {
    if (!populateOptions) {
      return await this.model.findOne(id);
    }
    return await this.model.findOne(id).populate(populateOptions);
  }

  async find(filter: object, populate?: string): Promise<T[]> {
    if (typeof populate !== 'undefined') {
      return await this.model.find(filter).populate(populate);
    }
    return await this.model.find(filter);
  }

  async create(dto: Partial<T>): Promise<T> {
    return await this.model.create(dto);
  }

  async update(id: string, dto: Partial<T>): Promise<T> {
    return await this.model.findOneAndUpdate({ _id: id }, dto, { new: true });
  }

  async delete<IdType>(id: IdType): Promise<boolean> {
    const deleteItem = await this.model.findById(id);
    if (!deleteItem) {
      return false;
    }
    return !!(await this.model.findByIdAndDelete(id));
  }
}
