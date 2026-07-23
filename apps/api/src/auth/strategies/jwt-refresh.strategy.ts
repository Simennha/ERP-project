import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import type { RefreshTokenPayload } from '@erp/contracts';
import { UsersService } from '../../users/users.service';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { REFRESH_TOKEN_COOKIE } from '../auth.constants';

/** Reads the refresh token from the httpOnly cookie (populated by cookie-parser). */
function cookieExtractor(req: Request): string | null {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  const token = cookies?.[REFRESH_TOKEN_COOKIE];
  return typeof token === 'string' ? token : null;
}

/**
 * Validates the long-lived refresh token from the refresh cookie. Used only by
 * the /auth/refresh route via JwtRefreshGuard. The signature is verified by
 * Passport; here we additionally assert the token type and that the user is
 * still active before allowing rotation.
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    config: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_REFRESH_SECRET'),
    });
  }

  async validate(payload: RefreshTokenPayload): Promise<AuthenticatedUser> {
    if (payload.tokenType !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }
    const user = await this.usersService.findActiveById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found or inactive');
    }
    return { userId: user.id, companyId: user.companyId, email: user.email };
  }
}
