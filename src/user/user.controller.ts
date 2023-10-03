import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Delete,
  BadRequestException,
  UseGuards,
  UseInterceptors,
  SerializeOptions,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from 'src/guard/jwt.auth.guard';
import { ParseObjectIdPipe } from 'src/pipe/objectId.pipe';
import { UserSerialize } from './interceptor/user.interceptor';

@Controller('user')
@UseGuards(JwtAuthGuard)
@SerializeOptions({
  excludePrefixes: ['password'],
})
@UseInterceptors(UserSerialize)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  fetch() {
    try {
      return this.userService.fetch();
    } catch (err) {
      return new BadRequestException(err.message);
    }
  }

  @Get(':id')
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    try {
      return this.userService.findOneById(id);
    } catch (err) {
      console.log(err.message);
      return new BadRequestException(err.message);
    }
  }

  @Patch(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    try {
      return this.userService.update(id, updateUserDto);
    } catch (err) {
      return new BadRequestException(err.message);
    }
  }

  @Delete(':id')
  delete(@Param('id', ParseObjectIdPipe) id: string) {
    try {
      return this.userService.delete(id);
    } catch (err) {
      return new BadRequestException(err.message);
    }
  }
}