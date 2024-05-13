import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

/**
 * This middleware is used to log all incoming requests to the server
 */
@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP-API-LOGGER');

  use(req: Request, res: Response, next: NextFunction) {
    const { ip, method, originalUrl } = req;
    const userAgent = req.get('user-agent') || '';

    res.on('finish', () => {
      const { statusCode } = res;
      const contentLength = res.get('content-length');
      this.logger.log(
        `${method} | ${originalUrl} | ${statusCode} | ${contentLength} | ${userAgent} | ${ip};`,
      );
      //@TODO: implement save log strategy later (save to file by day, remove old logs, etc.)
    });
    next();
  }
}
