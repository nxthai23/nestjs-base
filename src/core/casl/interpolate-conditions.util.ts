import { User } from '@api/user/entities/user.entity';

export function interpolateConditions(
  conditions: Record<string, unknown>,
  user: User,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(conditions)) {
    result[key] =
      typeof value === 'string' && value.startsWith('$')
        ? (user as unknown as Record<string, unknown>)[value.slice(1)]
        : value;
  }
  return result;
}
