import { HttpException, HttpStatus } from '@nestjs/common';

export const InternalServerError = (err, message: string) => {
  return new HttpException(
    {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: message,
    },
    HttpStatus.INTERNAL_SERVER_ERROR,
  );
};

export const BadRequest = (err, message: string) => {
  return new HttpException(
    {
      status: HttpStatus.BAD_REQUEST,
      message: message,
    },
    HttpStatus.BAD_REQUEST,
  );
};

export const NotFound = (err, message: string) => {
  return new HttpException(
    {
      status: HttpStatus.NOT_FOUND,
      message: message,
    },
    HttpStatus.NOT_FOUND,
  );
};
