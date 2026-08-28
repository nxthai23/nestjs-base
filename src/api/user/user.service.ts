import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository, RequiredEntityData } from '@mikro-orm/core';
import { User } from './entities/user.entity';
import { BaseService } from '@/core/base/base.service';
import { RoleService } from '@api/role/role.service';

@Injectable()
export class UserService extends BaseService<User> {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
    private readonly roleService: RoleService,
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

  async createWithDefaultRole(data: {
    username: string;
    password: string;
  }): Promise<Partial<User>> {
    const defaultRole = await this.roleService.findByName('user');
    if (!defaultRole) {
      throw new InternalServerErrorException(
        'Default "user" role is not seeded',
      );
    }
    return this.create({
      ...data,
      role: defaultRole,
    } as RequiredEntityData<User>);
  }
}
