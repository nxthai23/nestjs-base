import { BaseEntity as MikroOrmBaseEntity, Property } from '@mikro-orm/core';

export abstract class BaseEntity extends MikroOrmBaseEntity {
  @Property({ fieldName: 'created_at', type: 'timestamp' })
  createdAt: Date = new Date();

  @Property({
    fieldName: 'updated_at',
    type: 'timestamp',
    onUpdate: () => new Date(),
  })
  updatedAt: Date = new Date();
}
