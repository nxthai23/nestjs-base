import { SetMetadata } from '@nestjs/common';
import { AppAbility } from '@core/casl/casl-ability.factory';

export type PolicyHandlerCallback = (
  ability: AppAbility,
  request: any,
) => boolean;

export const CHECK_POLICIES_KEY = 'check_policies';

export const CheckPolicies = (...handlers: PolicyHandlerCallback[]) =>
  SetMetadata(CHECK_POLICIES_KEY, handlers);
