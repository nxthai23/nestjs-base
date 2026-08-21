import { Entity, PrimaryKey, Property, ManyToOne } from '@mikro-orm/decorators/legacy';
import { ObjectId } from '@mikro-orm/mongodb';
import { BaseEntity } from '@core/base/base.entity';
import { Role } from './role.entity';

@Entity({ collection: 'permissions' })
export class Permission extends BaseEntity {
  @PrimaryKey()
  _id!: ObjectId;

  @Property()
  action!: string;

  @Property()
  subject!: string;

  @Property({ type: Object, nullable: true })
  conditions?: Record<string, unknown>;

  @Property({ nullable: true })
  inverted?: boolean;

  @ManyToOne(() => Role)
  role!: Role;

  constructor(partial: Partial<Permission>) {
    super();
    Object.assign(this, partial);
  }
}
