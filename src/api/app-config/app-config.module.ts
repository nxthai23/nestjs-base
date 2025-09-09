import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { AppConfigService } from './app-config.service';
import { AppConfig } from '@api/app-config/entities/app-config.entity';

@Module({
  imports: [MikroOrmModule.forFeature([AppConfig])],
  controllers: [],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
