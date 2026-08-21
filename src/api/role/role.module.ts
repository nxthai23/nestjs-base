import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Role } from './entities/role.entity';
import { RoleService } from './role.service';

@Module({
  imports: [MikroOrmModule.forFeature([Role])],
  providers: [RoleService],
  exports: [RoleService],
})
export class RoleModule {}
