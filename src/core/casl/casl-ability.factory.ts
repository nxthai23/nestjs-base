import { Injectable } from '@nestjs/common';
import {
  createMongoAbility,
  MongoAbility,
  InferSubjects,
  RawRuleOf,
} from '@casl/ability';
import { User } from '@api/user/entities/user.entity';
import { interpolateConditions } from './interpolate-conditions.util';

type Subjects = InferSubjects<typeof User> | 'User' | 'all';
export type AppAbility = MongoAbility<[string, Subjects]>;

@Injectable()
export class CaslAbilityFactory {
  createForUser(user: User): AppAbility {
    const rules: RawRuleOf<AppAbility>[] = (user.role?.permissions.getItems() ?? [])
      .map((permission) => ({
        action: permission.action,
        subject: permission.subject as Extract<Subjects, string>,
        conditions: permission.conditions
          ? interpolateConditions(permission.conditions, user)
          : undefined,
        inverted: permission.inverted ?? false,
      }));

    return createMongoAbility<AppAbility>(rules);
  }
}
