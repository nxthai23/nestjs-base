import {
  Controller,
  Post,
  Body,
  SerializeOptions,
  UseInterceptors,
  UseFilters,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignInDto } from './dto/signIn.dto';
import { LoginDto } from './dto/login.dto';
import { UserSerialize } from 'src/api/user/interceptor/user.interceptor';
import { HttpExceptionFilter } from 'src/core/filter/http-exception.filter';

@Controller('auth')
@UseFilters(HttpExceptionFilter)
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @SerializeOptions({
    excludePrefixes: ['password'],
  })
  @UseInterceptors(UserSerialize)
  async login(@Body() loginDto: LoginDto) {
    try {
      const { type, username, password } = loginDto;
      const result = await this.authService.login(type, username, password);
      return result;
    } catch (err) {
      throw err;
    }
  }

  @Post('signIn')
  async signIn(@Body() signInDto: SignInDto) {
    try {
      const { type, user } = signInDto;
      const result = await this.authService.signIn(type, user);
      return result;
    } catch (err) {
      throw err;
    }
  }
}
