import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CaslAbilityFactory } from '@core/casl/casl-ability.factory';
import { CHECK_POLICIES_KEY, PolicyHandlerCallback } from '@core/decorators/check-policies.decorator';

@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private caslAbilityFactory: CaslAbilityFactory,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const handlers =
      this.reflector.get<PolicyHandlerCallback[]>(CHECK_POLICIES_KEY, context.getHandler()) ?? [];

    if (handlers.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const ability = this.caslAbilityFactory.createForUser(request.user);

    const allowed = handlers.every((handler) => handler(ability, request));
    if (!allowed) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}
