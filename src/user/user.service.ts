import { Inject, Injectable } from '@nestjs/common';
import { BaseServiceAbstract } from 'src/base/service/base.abstract.service';
import { User } from './entities/user.entity';
import { UserRepository } from './user.repository';

@Injectable()
export class UserService extends BaseServiceAbstract<User> {
  constructor(
    @Inject('UserRepository')
    private userRepository: UserRepository,
  ) {
    super(userRepository);
  }
}
