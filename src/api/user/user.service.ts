import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { User } from './entities/user.entity';
import { BaseService } from 'src/core/base/base.service';

@Injectable()
export class UserService extends BaseService<User> {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
  ) {
    super(userRepository);
  }

  async findByUsername(username: string): Promise<User> {
    const user = await this.userRepository.findOne({ username });
    if (!user) {
      throw new BadRequestException('User Not Found');
    }
    return user;
  }
}
