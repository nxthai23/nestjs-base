import {
  Entity,
  PrimaryKey,
  Property,
  OneToMany,
} from '@mikro-orm/decorators/legacy';
import { Collection } from '@mikro-orm/core';
import { ObjectId } from '@mikro-orm/mongodb';
import { BaseEntity } from '@core/base/base.entity';
import { Permission } from './permission.entity';

@Entity({ collection: 'roles' })
export class Role extends BaseEntity {
  @PrimaryKey()
  _id!: ObjectId;

  @Property({ unique: true })
  name!: string;

  @OneToMany(() => Permission, (permission) => permission.role)
  permissions = new Collection<Permission>(this);

  constructor(partial: Partial<Role>) {
    super();
    Object.assign(this, partial);
  }
}
