import {
  Controller,
  Get,
  Body,
  Patch,
  Delete,
  UseGuards,
  UseInterceptors,
  SerializeOptions,
  Query,
  Req,
  UseFilters,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from 'src/common/guard/jwt.auth.guard';
import { UserSerialize } from './interceptor/user.interceptor';
import { HttpExceptionFilter } from 'src/common/filter/http-exception';

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
  fetch(@Query('query') query?: object) {
    try {
      if (!query) {
        return this.userService.findAll();
      }
      return this.userService.find(query);
    } catch (err) {
      throw err;
    }
  }

  @Get('/me')
  async findOne(@Req() req: Request) {
    try {
      const userId = req['userId'];
      return await this.userService.findOne(userId);
    } catch (err) {
      throw err;
    }
  }

  @Patch('/me')
  update(@Req() req: Request, @Body() updateUserDto: UpdateUserDto) {
    try {
      const userId = req['userId'];
      return this.userService.update(userId, updateUserDto);
    } catch (err) {
      throw err;
    }
  }

  @Delete('/me')
  delete(@Req() req: Request) {
    try {
      const userId = req['userId'];
      return this.userService.delete(userId);
    } catch (err) {
      throw err;
    }
  }
}
