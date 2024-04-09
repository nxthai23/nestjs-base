import { ClassSerializerInterceptor, Injectable } from '@nestjs/common';
import { ClassTransformOptions } from 'class-transformer';

@Injectable()
export class UserSerialize extends ClassSerializerInterceptor {
  serialize(response: any, options: ClassTransformOptions) {
    const rawDataJSON = JSON.stringify(response);
    return super.serialize(JSON.parse(rawDataJSON), options);
  }
}
