import { ClientSession, Model } from 'mongoose';
import { BaseRepositoryInterface } from './base.interface.repository';

export abstract class BaseRepositoryAbstract<T>
  implements BaseRepositoryInterface<T>
{
  constructor(private model: Model<T>) {
    this.model = model;
  }

  async findOne<IdType, T>(
    id: IdType,
    populateOptions?: any,
  ): Promise<T | any> {
    const result = this.model.findOne(id);
    if (populateOptions) {
      await result.populate(populateOptions);
    }
    return await result.exec();
  }

  async find(filter: object, populate?: string): Promise<T[]> {
    const result = this.model.find(filter);
    if (populate) {
      result.populate(populate);
    }

    return await result.exec();
  }

  async create(dto: Partial<T>, session?: ClientSession): Promise<T | any> {
    return await this.model.create([dto], { session });
  }

  async update(
    id: string,
    dto: Partial<T>,
    session?: ClientSession,
  ): Promise<T> {
    return await this.model.findOneAndUpdate({ _id: id }, dto, {
      new: true,
      session,
    });
  }

  async delete<IdType>(id: IdType, session?: ClientSession): Promise<boolean> {
    const deleteItem = await this.model.findById(id);
    if (!deleteItem) {
      return false;
    }
    return !!(await this.model.findByIdAndDelete(id, { session }));
  }
}
