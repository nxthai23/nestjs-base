import { subject } from '@casl/ability';
import { CaslAbilityFactory } from '../casl-ability.factory';
import { User } from '@api/user/entities/user.entity';

type FakePermission = { action: string; subject: string; conditions?: Record<string, unknown> };

function makeUser(permissions: FakePermission[], id = 'user-1'): User {
  return {
    id,
    role: {
      permissions: {
        getItems: () => permissions,
      },
    },
  } as unknown as User;
}

describe('CaslAbilityFactory', () => {
  const factory = new CaslAbilityFactory();

  it('grants full access for an admin-shaped role (manage/all)', () => {
    const admin = makeUser([{ action: 'manage', subject: 'all' }]);
    const ability = factory.createForUser(admin);

    expect(ability.can('read', 'User')).toBe(true);
    expect(ability.can('delete', 'User')).toBe(true);
  });

  it('scopes a user-shaped role to only their own User record', () => {
    const owner = makeUser(
      [
        { action: 'read', subject: 'User', conditions: { id: '$id' } },
        { action: 'update', subject: 'User', conditions: { id: '$id' } },
      ],
      'user-1',
    );
    const ownRecord = { id: 'user-1' } as User;
    const otherRecord = { id: 'user-2' } as User;

    const ability = factory.createForUser(owner);

    expect(ability.can('read', subject('User', ownRecord))).toBe(true);
    expect(ability.can('update', subject('User', ownRecord))).toBe(true);
    expect(ability.can('read', subject('User', otherRecord))).toBe(false);
    expect(ability.can('delete', subject('User', ownRecord))).toBe(false);
  });
});
