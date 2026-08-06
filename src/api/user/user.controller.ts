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
import { UserSerialize } from './interceptor/user.interceptor';
import { HttpExceptionFilter } from '@/core/filter/http-exception.filter';
import { ApiResult } from '@core/response/api-result';

// @TODO: add admin validation later for this controller

@Controller('users')
@UseGuards(JwtAuthGuard)
@SerializeOptions({
  excludePrefixes: ['password'],
})
@UseInterceptors(UserSerialize)
@UseFilters(HttpExceptionFilter)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  async fetch() {
    const users = await this.userService.findAll();
    return ApiResult.success(users, 'Users retrieved successfully');
  }

  @Get('/me')
  async findOne(@Req() req: Request) {
    const userId = req['userId'];
    const user = await this.userService.findById(userId);
    return ApiResult.success(user, 'User retrieved successfully');
  }

  @Patch('/me')
  async update(@Req() req: Request, @Body() updateUserDto: UpdateUserDto) {
    const userId = req['userId'];
    const user = await this.userService.update(userId, updateUserDto);
    return ApiResult.success(user, 'User updated successfully');
  }

  @Delete('/me')
  async delete(@Req() req: Request) {
    const userId = req['userId'];
    const user = await this.userService.delete(userId);
    return ApiResult.success(user, 'User deleted successfully');
  }
}
