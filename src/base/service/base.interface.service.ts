export interface Read<T> {
  findOne<IdType, T>(id: IdType, populateOptions?: string): Promise<T | any>;
  find(filter: object, populateOptions?: string): Promise<T[]>;
  findAll(populateOptions?: string): Promise<T[]>;
}

export interface Write<T> {
  create(dto: Partial<T>): Promise<Partial<T>>;
  update(id: string, dto: Partial<T>): Promise<Partial<T>>;
  delete<IdType>(id: IdType): Promise<boolean>;
}

export interface BaseServiceInterface<T> extends Write<T>, Read<T> {}
