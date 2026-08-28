import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PoliciesGuard } from '../policies.guard';
import { CaslAbilityFactory } from '@core/casl/casl-ability.factory';

describe('PoliciesGuard', () => {
  const mockUser = { id: 'user-1' };
  const mockAbility = { can: jest.fn() };

  function makeContext() {
    return {
      getHandler: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user: mockUser }),
      }),
    } as any;
  }

  function makeReflector(returnValue: any) {
    return {
      get: jest.fn().mockReturnValue(returnValue),
    } as unknown as Reflector;
  }

  function makeFactory() {
    return {
      createForUser: jest.fn().mockReturnValue(mockAbility),
    } as unknown as CaslAbilityFactory;
  }

  it('allows the request when there are no policy handlers', () => {
    const guard = new PoliciesGuard(makeReflector(undefined), makeFactory());
    expect(guard.canActivate(makeContext())).toBe(true);
  });

  it('allows the request when every handler passes', () => {
    const factory = makeFactory();
    const guard = new PoliciesGuard(
      makeReflector([() => true, () => true]),
      factory,
    );

    expect(guard.canActivate(makeContext())).toBe(true);
    expect(factory.createForUser).toHaveBeenCalledWith(mockUser);
  });

  it('throws ForbiddenException when any handler fails', () => {
    const guard = new PoliciesGuard(
      makeReflector([() => true, () => false]),
      makeFactory(),
    );
    expect(() => guard.canActivate(makeContext())).toThrow(ForbiddenException);
  });
});
