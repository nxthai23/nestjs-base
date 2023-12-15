import { Injectable } from '@nestjs/common';
import { UserService } from 'src/user/user.service';
import { User } from 'src/user/entities/user.entity';
import { ConfigService } from '@nestjs/config';
import { LocalStrategy } from './strategies/local';
import { JwtService } from '@nestjs/jwt';
import { CreateUserDto } from 'src/user/dto/create-user.dto';
import { LoginResponse } from './dto/login.dto';

interface JwtPayload {
  sub: string;
}

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
    const user: User = (await this.userService.find({ username }))[0];
    if (!user) throw new Error('User not found!');
    /**
     * Implement others auth strategies here
     */
    switch (authType.toUpperCase()) {
      case this.configService.get<string>('local'):
        await this.localStrategy.validate(password, user.password);
        const payload: JwtPayload = {
          sub: user._id,
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
