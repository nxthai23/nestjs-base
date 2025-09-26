import { Controller, Get } from '@nestjs/common';
import { AppConfigService } from './app-config.service';

@Controller('app-config')
export class AppConfigController {
  constructor(private readonly appConfigService: AppConfigService) {}

  @Get()
  findAll() {
    return this.appConfigService.findAllActivePublicConfigs();
  }
}
