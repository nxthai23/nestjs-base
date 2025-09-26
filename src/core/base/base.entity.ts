import {
  BaseEntity as MikroOrmBaseEntity,
  Property,
  SerializedPrimaryKey,
} from '@mikro-orm/core';

export abstract class BaseEntity extends MikroOrmBaseEntity {
  @SerializedPrimaryKey()
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
