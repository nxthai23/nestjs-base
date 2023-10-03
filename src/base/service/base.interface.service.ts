export interface Read<T> {
  fetch(): Promise<T[]>;
  findOneById(id: string): Promise<T>;
  find(filter: object, populate?: string): Promise<T[]>;
  findOne(filter: object, populate?: string): Promise<T>;
}

export interface Write<T> {
  create(dto: Partial<T>): Promise<T>;
  update(id: string, dto: T | any): Promise<T>;
  delete<IdType>(id: IdType): Promise<IdType>;
}

export interface BaseServiceInterface<T> extends Write<T>, Read<T> {}
