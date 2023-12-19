import {
  Controller,
  Get,
  Body,
  Patch,
  Delete,
  BadRequestException,
  UseGuards,
  UseInterceptors,
  SerializeOptions,
  Query,
  Req,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from 'src/guard/jwt.auth.guard';
import { UserSerialize } from './interceptor/user.interceptor';

// @TODO: add admin validation later for this controller

@Controller('users')
@UseGuards(JwtAuthGuard)
@SerializeOptions({
  excludePrefixes: ['password'],
})
@UseInterceptors(UserSerialize)
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
      return new BadRequestException(err.message);
    }
  }

  @Get('/me')
  async findOne(@Req() req: Request) {
    try {
      const userId = req['userId'];
      return await this.userService.findOne(userId);
    } catch (err) {
      console.log(err.message);
      return new BadRequestException(err.message);
    }
  }

  @Patch('/me')
  update(@Req() req: Request, @Body() updateUserDto: UpdateUserDto) {
    try {
      const userId = req['userId'];
      return this.userService.update(userId, updateUserDto);
    } catch (err) {
      return new BadRequestException(err.message);
    }
  }

  @Delete('/me')
  delete(@Req() req: Request) {
    try {
      const userId = req['userId'];
      return this.userService.delete(userId);
    } catch (err) {
      return new BadRequestException(err.message);
    }
  }
}
