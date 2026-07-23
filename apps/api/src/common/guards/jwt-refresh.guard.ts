import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard for the token-refresh route. Validates the refresh token read from the
 * httpOnly cookie via the 'jwt-refresh' Passport strategy. Applied explicitly
 * with @UseGuards(JwtRefreshGuard) on /auth/refresh (which is also @Public so
 * the global access-token guard does not run there).
 */
@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {}
