import { User } from 'src/api/user/entities/user.entity';

export class LoginDto {
  type: string;
  username: string;
  password: string;
}

export class LoginResponse {
  accessToken: string;
  user: User;
}
