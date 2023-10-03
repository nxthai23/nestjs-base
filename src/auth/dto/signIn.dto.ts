import { IsString } from 'class-validator';
import { CreateUserDto } from 'src/user/dto/create-user.dto';

export class SignInDto {
  @IsString()
  type: string;

  user: CreateUserDto;
}
