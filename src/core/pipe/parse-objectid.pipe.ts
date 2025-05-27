import { ObjectId } from '@mikro-orm/mongodb';
import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

// transform id as string from request to ObjectId
@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, ObjectId> {
  transform(value: string): ObjectId {
    const validObjectId = ObjectId.isValid(value);
    if (!validObjectId) {
      throw new BadRequestException('Id Validation failed');
    }
    return ObjectId.createFromHexString(value);
  }
}
