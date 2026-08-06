import { Controller, Get } from '@nestjs/common';
import { AppConfigService } from './app-config.service';
import { ApiResult } from '@core/response/api-result';

@Controller('app-config')
export class AppConfigController {
  constructor(private readonly appConfigService: AppConfigService) {}

  @Get()
  async findAll() {
    const configs = await this.appConfigService.findAllActivePublicConfigs();
    return ApiResult.success(configs, 'App configs retrieved successfully');
  }
}
