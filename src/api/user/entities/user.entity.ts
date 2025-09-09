import {
  Entity,
  Property,
  PrimaryKey,
  SerializedPrimaryKey,
} from '@mikro-orm/core';
import { ObjectId } from '@mikro-orm/mongodb';
import { BaseEntity } from '../../../core/base/base.entity';
import { Exclude } from 'class-transformer';

@Entity({
  collection: 'users',
})
export class User extends BaseEntity {
  @PrimaryKey()
  _id!: ObjectId;

  @SerializedPrimaryKey()
  id!: string;

  @Property()
  username!: string;

  @Property()
  @Exclude()
  password!: string;

  constructor(partial: Partial<User>) {
    super();
    Object.assign(this, partial);
  }
}
