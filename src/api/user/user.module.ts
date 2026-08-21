import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { User } from './entities/user.entity';
import { JwtMiddleware } from '@/core/middlewares/jwt.middleware';
import { JwtService } from '@nestjs/jwt';
import { JwtStrategy } from '@/api/auth/strategies/jwt';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RoleModule } from '@api/role/role.module';
import { CaslModule } from '@core/casl/casl.module';

@Module({
  imports: [MikroOrmModule.forFeature([User]), RoleModule, CaslModule],
  controllers: [UserController],
  providers: [UserService, JwtService, JwtStrategy],
  exports: [UserService],
})
export class UserModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(JwtMiddleware).forRoutes(UserController);
  }
}
