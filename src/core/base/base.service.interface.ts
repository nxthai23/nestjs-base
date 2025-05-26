import { ObjectId } from '@mikro-orm/mongodb';

/**
 * Base service interface that defines common CRUD operations
 * @template T - The entity type
 * @template CreateDTO - The DTO type for creation
 * @template UpdateDTO - The DTO type for updates
 * @template IdType - The type of entity ID (string | ObjectId | number)
 */
export interface IBaseService<
  T,
  CreateDTO,
  UpdateDTO,
  IdType = string | ObjectId | number,
> {
  /**
   * Find all entities with optional filtering and pagination
   * @param filter Optional filter criteria
   * @param page Optional page number for pagination
   * @param limit Optional limit of items per page
   */
  findAll(filter?: Partial<T>, page?: number, limit?: number): Promise<T[]>;

  /**
   * Find a single entity by ID
   * @param id The ID of the entity to find
   */
  findById(id: IdType): Promise<T>;

  /**
   * Find a single entity by criteria
   * @param filter The filter criteria
   */
  findOne(filter: Partial<T>): Promise<T>;

  /**
   * Create a new entity
   * @param data The data to create the entity with
   */
  create(data: CreateDTO): Promise<T>;

  /**
   * Update an existing entity
   * @param id The ID of the entity to update
   * @param data The data to update the entity with
   */
  update(id: IdType, data: UpdateDTO): Promise<T>;
}
