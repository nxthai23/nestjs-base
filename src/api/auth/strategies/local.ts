import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super();
  }

  async hash(plainPassword: string): Promise<string> {
    try {
      const hash = await bcrypt.hash(
        plainPassword,
        this.configService.get<number>('saltRound'),
      );
      return hash;
    } catch (err) {
      if (err instanceof Error) {
        console.log(err.message);
      }
      throw Error('Error hashing password');
    }
  }

  async validate(
    plainPassword: string,
    hashPassword: string,
  ): Promise<boolean> {
    try {
      const isMatch = await bcrypt.compare(plainPassword, hashPassword);
      return isMatch;
    } catch {
      throw new UnauthorizedException('Wrong password!');
    }
  }
}
