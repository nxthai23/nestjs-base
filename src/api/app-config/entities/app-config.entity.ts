import { Entity, PrimaryKey, Property } from '@mikro-orm/core';
import { ObjectId } from '@mikro-orm/mongodb';
import { BaseEntity } from '@core/base/base.entity';

@Entity({ collection: 'app_config' })
export class AppConfig extends BaseEntity {
  @PrimaryKey()
  _id!: ObjectId;

  @Property({ unique: true })
  key: string;

  @Property({ type: Object })
  value: any;

  @Property()
  description: string;

  @Property({ default: true })
  isActive: boolean;

  @Property({ default: false })
  isPublic: boolean;

  constructor(partial: Partial<AppConfig>) {
    super();
    Object.assign(this, partial);
  }
}
