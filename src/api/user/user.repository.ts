import { BaseRepositoryAbstract } from 'src/base/repository/base.abstract.repository';
import { User } from './entities/user.entity';
import { Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { BaseRepositoryInterface } from 'src/base/repository/base.interface.repository';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface UserRepositoryInterface
  extends BaseRepositoryInterface<User> {}

@Injectable()
export class UserRepository
  extends BaseRepositoryAbstract<User>
  implements UserRepositoryInterface
{
  constructor(@InjectModel(User.name) private readonly userModel: Model<User>) {
    super(userModel);
  }
}
