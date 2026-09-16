import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { get } from 'lodash';
import { ApiResult } from '../response/api-result';
import { AppException } from '../exceptions/app.exception';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();
    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : get(exceptionResponse, 'message', 'Internal server error');
    const code = exception instanceof AppException ? exception.code : undefined;

    response
      .status(status)
      .json(ApiResult.error(message, status, request.url, undefined, code));
  }
}
