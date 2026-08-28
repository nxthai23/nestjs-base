import { interpolateConditions } from '../interpolate-conditions.util';
import { User } from '@api/user/entities/user.entity';

describe('interpolateConditions', () => {
  it('replaces $field placeholders with the value from the user', () => {
    const user = { id: 'user-123' } as User;
    const result = interpolateConditions({ id: '$id' }, user);
    expect(result).toEqual({ id: 'user-123' });
  });

  it('passes through literal (non-$-prefixed) values unchanged', () => {
    const user = { id: 'user-123' } as User;
    const result = interpolateConditions({ status: 'active' }, user);
    expect(result).toEqual({ status: 'active' });
  });

  it('handles a mix of placeholder and literal values', () => {
    const user = { id: 'user-123' } as User;
    const result = interpolateConditions({ id: '$id', status: 'active' }, user);
    expect(result).toEqual({ id: 'user-123', status: 'active' });
  });
});
