import { BaseEntity as MikroOrmBaseEntity } from '@mikro-orm/core';
import { Property, SerializedPrimaryKey } from '@mikro-orm/decorators/legacy';

export abstract class BaseEntity extends MikroOrmBaseEntity {
  @SerializedPrimaryKey({ type: 'string' })
  id!: string;

  @Property({ fieldName: 'created_at', type: 'timestamp' })
  createdAt: Date = new Date();

  @Property({
    fieldName: 'updated_at',
    type: 'timestamp',
    onUpdate: () => new Date(),
  })
  updatedAt: Date = new Date();
}
