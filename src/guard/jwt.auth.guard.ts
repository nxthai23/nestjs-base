import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Overall, guards are used to authenticate a user before they can access a route
 * - authentication: check valid user credentials, jwt
 * - authorization: checks if the user has the right to access (role) the route
 * This guard is used to protect routes that require a valid JWT token
 * @see https://docs.nestjs.com/guards
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
