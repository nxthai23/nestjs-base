import {
  Controller,
  Get,
  Body,
  Patch,
  Delete,
  UseGuards,
  UseInterceptors,
  SerializeOptions,
  Req,
  UseFilters,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '@/core/guard/jwt.auth.guard';
import { PoliciesGuard } from '@core/guard/policies.guard';
import { CheckPolicies } from '@core/decorators/check-policies.decorator';
import { Action } from '@core/casl/action.enum';
import { UserSerialize } from './interceptor/user.interceptor';
import { HttpExceptionFilter } from '@/core/filter/http-exception.filter';
import { ApiResult } from '@core/response/api-result';

@Controller('users')
@UseGuards(JwtAuthGuard, PoliciesGuard)
@SerializeOptions({
  excludePrefixes: ['password'],
})
@UseInterceptors(UserSerialize)
@UseFilters(HttpExceptionFilter)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @CheckPolicies((ability) => ability.can(Action.Read, 'all'))
  async fetch() {
    const users = await this.userService.findAll();
    return ApiResult.success(users, 'Users retrieved successfully');
  }

  @Get('/me')
  @CheckPolicies((ability, req) => ability.can(Action.Read, req.user))
  async findOne(@Req() req: Request & { user: any }) {
    const user = await this.userService.findById(req.user.id);
    return ApiResult.success(user, 'User retrieved successfully');
  }

  @Patch('/me')
  @CheckPolicies((ability, req) => ability.can(Action.Update, req.user))
  async update(
    @Req() req: Request & { user: any },
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const user = await this.userService.update(req.user.id, updateUserDto);
    return ApiResult.success(user, 'User updated successfully');
  }

  @Delete('/me')
  @CheckPolicies((ability, req) => ability.can(Action.Delete, req.user))
  async delete(@Req() req: Request & { user: any }) {
    const user = await this.userService.delete(req.user.id);
    return ApiResult.success(user, 'User deleted successfully');
  }
}
