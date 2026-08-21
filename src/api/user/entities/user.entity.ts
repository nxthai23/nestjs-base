import { Entity, Property, PrimaryKey, ManyToOne } from '@mikro-orm/decorators/legacy';
import { ObjectId } from '@mikro-orm/mongodb';
import { BaseEntity } from '../../../core/base/base.entity';
import { Exclude } from 'class-transformer';
import { Role } from '@api/role/entities/role.entity';

@Entity({
  collection: 'users',
})
export class User extends BaseEntity {
  @PrimaryKey()
  _id!: ObjectId;

  @Property()
  username!: string;

  @Property()
  @Exclude()
  password!: string;

  @ManyToOne(() => Role)
  role!: Role;

  constructor(partial: Partial<User>) {
    super();
    Object.assign(this, partial);
  }
}
