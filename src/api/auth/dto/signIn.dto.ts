import { IsString } from 'class-validator';
import { CreateUserDto } from 'src/api/user/dto/create-user.dto';

export class SignInDto {
  @IsString()
  type: string;

  user: CreateUserDto;
}
