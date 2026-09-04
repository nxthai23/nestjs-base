import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { User } from './entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import { JwtStrategy } from '@/api/auth/strategies/jwt';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RoleModule } from '@api/role/role.module';
import { CaslModule } from '@core/casl/casl.module';

@Module({
  imports: [
    MikroOrmModule.forFeature([User]),
    RoleModule,
    CaslModule,
    // UserController guards JwtAuthGuard (extends passport's AuthGuard),
    // which injects AuthModuleOptions. UserModule never imports AuthModule,
    // so PassportModule must be registered here directly - .register({})
    // is required (not the bare module) so AuthModuleOptions actually gets
    // bound to a provider.
    PassportModule.register({}),
  ],
  controllers: [UserController],
  providers: [UserService, JwtService, JwtStrategy],
  exports: [UserService],
})
export class UserModule {}
