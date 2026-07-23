import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ClsService } from 'nestjs-cls';
import type { AccessTokenPayload } from '@erp/contracts';
import { UsersService } from '../../users/users.service';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CLS_COMPANY_ID, CLS_USER_ID } from '../../common/cls/cls-keys';

/**
 * Validates the short-lived access token from the `Authorization: Bearer`
 * header. On success it seeds request-scoped CLS context and returns the
 * object Passport attaches to `req.user`.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly cls: ClsService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    const user = await this.usersService.findActiveById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found or inactive');
    }

    this.cls.set(CLS_USER_ID, user.id);
    this.cls.set(CLS_COMPANY_ID, user.companyId);

    return { userId: user.id, companyId: user.companyId, email: user.email };
  }
}
