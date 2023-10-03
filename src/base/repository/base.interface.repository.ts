export interface BaseRepositoryInterface<T> {
  fetch(populate?: string): Promise<T[]>;
  findOneById(id: string, populate?: string): Promise<T>;
  findOne(filter: object, populate?: string): Promise<T>;
  find(filter: object, populate?: string): Promise<T[]>;
  create(dto: Partial<T>): Promise<T>;
  update(id: string, dto: Partial<T>): Promise<T>;
  delete<IdType>(id: IdType): Promise<IdType>;
  // softDelete(id: string): Promise<T>;
}
