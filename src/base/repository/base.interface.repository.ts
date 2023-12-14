export interface BaseRepositoryInterface<T> {
  findOne<IdType, T>(id: IdType, populateOptions?: string): Promise<T | any>;

  find(filterOptions: object, populateOptions?: string): Promise<T[] | any[]>;

  create(dto: Partial<T>): Promise<Partial<T>>;

  update(id: string, dto: Partial<T>): Promise<Partial<T>>;

  delete<IdType>(id: IdType): Promise<boolean>;
}
