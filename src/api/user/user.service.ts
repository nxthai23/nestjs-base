import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { User } from './entities/user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
    private readonly em: EntityManager,
  ) {}

  async create(createUserData: Partial<User>): Promise<User> {
    const user = this.em.create(User, createUserData);
    await this.em.persistAndFlush(user);
    return user;
  }

  async findAll(): Promise<User[]> {
    return await this.userRepository.findAll();
  }

  async findById(id: string): Promise<User | null> {
    return await this.userRepository.findOne(id);
  }

  async findByUsername(username: string): Promise<User | null> {
    return await this.userRepository.findOne({ username });
  }

  async update(id: string, updateData: Partial<User>): Promise<User | null> {
    const user = await this.userRepository.findOne(id);
    if (!user) {
      return null;
    }

    this.em.assign(user, updateData);
    await this.em.flush();

    return user;
  }

  async delete(id: string): Promise<boolean> {
    const user = await this.userRepository.findOne(id);
    if (!user) {
      return false;
    }

    await this.em.removeAndFlush(user);
    return true;
  }
}
