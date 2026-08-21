import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { SeederService } from './seeder.service';
import { AppConfig } from '@api/app-config/entities/app-config.entity';
import { Role } from '@api/role/entities/role.entity';
import { Permission } from '@api/role/entities/permission.entity';

@Module({
  imports: [MikroOrmModule.forFeature([AppConfig, Role, Permission])],
  controllers: [],
  providers: [SeederService],
  exports: [SeederService],
})
export class SeederModule {}
