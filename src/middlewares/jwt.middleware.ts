import { Injectable, NestMiddleware } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NextFunction } from 'express';
import { JwtStrategy } from 'src/auth/strategies/jwt';
import { ParseObjectIdPipe } from 'src/pipe/objectId.pipe';

@Injectable()
export class JwtMiddleware implements NestMiddleware {
  constructor(
    private jwtService: JwtService,
    private jwtStrategy: JwtStrategy,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization'];
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      const decodedToken = await this.jwtStrategy.validate(
        this.jwtService.decode(token),
      );
      console.log(decodedToken);
      const userId = ParseObjectIdPipe.prototype.transform(decodedToken.userId);
      req['userId'] = userId;
    }
    next();
  }
}
