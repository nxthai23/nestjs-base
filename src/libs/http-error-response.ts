import { HttpException, HttpStatus } from '@nestjs/common';

export const InternalServerError = (err, message: string) => {
  return new HttpException(
    {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      error: message,
    },
    HttpStatus.INTERNAL_SERVER_ERROR,
    {
      cause: err,
    },
  );
};

export const BadRequest = (err, message: string) => {
  return new HttpException(
    {
      status: HttpStatus.BAD_REQUEST,
      error: message,
    },
    HttpStatus.BAD_REQUEST,
    {
      cause: err,
    },
  );
};
