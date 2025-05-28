import { Injectable, NotFoundException } from '@nestjs/common';
import { UserService } from 'src/api/user/user.service';
import { User } from 'src/api/user/entities/user.entity';
import { ConfigService } from '@nestjs/config';
import { LocalStrategy } from './strategies/local';
import { JwtService } from '@nestjs/jwt';
import { CreateUserDto } from 'src/api/user/dto/create-user.dto';
import { LoginResponse } from './dto/login.dto';
import { JwtPayload } from './auth.type';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private configService: ConfigService,
    private localStrategy: LocalStrategy,
    private jwtService: JwtService,
  ) {}

  async login(
    authType: string,
    username: string,
    password: string,
  ): Promise<LoginResponse> {
    const user: User = await this.userService.findByUsername(username);
    if (!user) throw new NotFoundException('User not found!');
    /**
     * Implement others auth strategies here
     */
    switch (authType.toUpperCase()) {
      case this.configService.get<string>('local'):
        await this.localStrategy.validate(password, user.password);
        const payload: JwtPayload = {
          sub: user._id.toString(),
        };
        const accessToken = await this.jwtService.signAsync(payload);
        return { accessToken, user };
      default:
        throw new Error('Does not support this authType!');
    }
  }

  async signIn(authType: string, user: CreateUserDto): Promise<User> {
    const { username, password } = user;
    const hashPassword = await this.localStrategy.hash(password);
    const userData: Partial<CreateUserDto> = {
      username,
      password: hashPassword,
    };
    let result: any;
    switch (authType.toUpperCase()) {
      case this.configService.get<string>('local'):
        const user = await this.userService.create(userData);
        result = user;
        break;
      default:
        throw new Error(`Auth type: ${authType} not supported`);
    }
    return result;
  }
}
