import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { SeederService } from './seeder.service';
import { AppConfig } from '@api/app-config/entities/app-config.entity';

@Module({
  imports: [MikroOrmModule.forFeature([AppConfig])],
  controllers: [],
  providers: [SeederService],
  exports: [SeederService],
})
export class SeederModule {}
