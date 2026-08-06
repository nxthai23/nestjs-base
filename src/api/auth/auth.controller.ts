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
import { UserSerialize } from '@/api/user/interceptor/user.interceptor';
import { HttpExceptionFilter } from '@/core/filter/http-exception.filter';
import { ApiResult } from '@core/response/api-result';

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
    const { type, username, password } = loginDto;
    const result = await this.authService.login(type, username, password);
    return ApiResult.success(result, 'Login successful');
  }

  @Post('signIn')
  async signIn(@Body() signInDto: SignInDto) {
    const { type, user } = signInDto;
    const result = await this.authService.signIn(type, user);
    return ApiResult.success(result, 'User registered successfully');
  }
}
