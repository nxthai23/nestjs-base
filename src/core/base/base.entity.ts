import { BaseEntity as MikroOrmBaseEntity, Property } from '@mikro-orm/core';

export abstract class BaseEntity extends MikroOrmBaseEntity {
  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
