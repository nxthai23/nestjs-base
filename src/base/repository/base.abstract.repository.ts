import { Model } from 'mongoose';
import { BaseRepositoryInterface } from './base.interface.repository';

export abstract class BaseRepositoryAbstract<T>
  implements BaseRepositoryInterface<T>
{
  constructor(private model: Model<T>) {
    this.model = model;
  }
  async findOne(filter: object, populate?: string): Promise<T | any> {
    if (typeof populate !== 'undefined') {
      return await this.model.findOne(filter).populate(populate);
    }
    return await this.model.findOne(filter);
  }

  async find(filter: object, populate?: string): Promise<T[]> {
    if (typeof populate !== 'undefined') {
      return await this.model.find(filter).populate(populate);
    }
    return await this.model.find(filter);
  }

  async fetch(populate?: string): Promise<T[]> {
    if (typeof populate !== 'undefined') {
      return await this.model.find().populate(populate);
    }
    return await this.model.find();
  }
  async findOneById(id: string, populate?: string): Promise<T | any> {
    if (typeof populate !== 'undefined') {
      return await this.model.findById(id).populate(populate);
    }
    return await this.model.findById(id);
  }
  async create(dto: Partial<T>): Promise<T> {
    return await this.model.create(dto);
  }
  async update(id: string, dto: Partial<T>): Promise<T> {
    return await this.model.findOneAndUpdate(
      { _id: id, deleted_at: null },
      dto,
      { new: true },
    );
  }
  async delete<IdType>(id: IdType): Promise<IdType> {
    const item = await this.model.findById(id);
    return item.id;
  }
  // async softDelete(id: string): Promise<boolean> {
  //   const deleteItem = await this.model.findById(id);
  //   if (!deleteItem) return false;
  //   return !!(await this.model.findByIdAndUpdate<T>(id,
  //     deleted_at: new Date(),
  //   ));
  // }
}
