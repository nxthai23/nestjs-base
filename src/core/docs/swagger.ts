import { Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

type SwaggerConfig = {
  title: string;
  description: string;
  version: string;
  tag: string;
};

export class Swagger {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  constructor() {}

  getConfig(config: SwaggerConfig) {
    const { title, description, version, tag } = config;
    const swaggerConfig = new DocumentBuilder()
      .setTitle(title)
      .setDescription(description)
      .setVersion(version)
      .addTag(tag)
      .build();
    return swaggerConfig;
  }

  setupSwagger(app, config: SwaggerConfig) {
    const swaggerConfig = this.getConfig(config);
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('swagger', app, document);
    // logging what is the url for swagger
    Logger.log(
      `Swagger is running on http://localhost:${process.env.APP_PORT}/swagger`,
      'Swagger',
    );
  }
}
