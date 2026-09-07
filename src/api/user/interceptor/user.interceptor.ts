import { ClassSerializerInterceptor, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClassTransformOptions } from 'class-transformer';

@Injectable()
export class UserSerialize extends ClassSerializerInterceptor {
  // Declaring the constructor explicitly (instead of relying on the
  // inherited one) keeps design:paramtypes/@Optional() metadata on this
  // class itself rather than depending on prototype-chain lookup.
  constructor(reflector: Reflector) {
    super(reflector);
  }

  serialize(response: any, options: ClassTransformOptions) {
    const rawDataJSON = JSON.stringify(response);
    return super.serialize(JSON.parse(rawDataJSON), options);
  }
}
