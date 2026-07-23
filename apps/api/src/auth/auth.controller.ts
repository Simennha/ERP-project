import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import {
  loginSchema,
  type LoginInput,
  type LoginResponse,
  type MeResponse,
  type RefreshResponse,
} from '@erp/contracts';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtRefreshGuard } from '../common/guards/jwt-refresh.guard';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import {
  REFRESH_COOKIE_MAX_AGE_MS,
  REFRESH_COOKIE_PATH,
  REFRESH_TOKEN_COOKIE,
} from './auth.constants';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
  ) {}

  // Stricter than the app-wide default (see app.module.ts) — login is the one
  // endpoint worth protecting from credential-stuffing/brute-force
  // specifically. 5 attempts/minute per IP is generous for a real user
  // (typos happen) but hostile to automated guessing.
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    const { accessToken, refreshToken, user } = await this.authService.login(
      body.email,
      body.password,
    );
    this.setRefreshCookie(res, refreshToken);
    return { accessToken, user };
  }

  // Looser than login (refresh legitimately fires on every reload/new tab)
  // but still bounded — refresh tokens are themselves bearer credentials.
  @Public()
  @UseGuards(JwtRefreshGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @CurrentUser() current: AuthenticatedUser | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RefreshResponse> {
    if (!current) {
      throw new UnauthorizedException();
    }
    const { accessToken, refreshToken } = await this.authService.refresh(current.userId);
    this.setRefreshCookie(res, refreshToken);
    return { accessToken };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response): { success: boolean } {
    this.clearRefreshCookie(res);
    return { success: true };
  }

  @Get('me')
  async me(@CurrentUser() current: AuthenticatedUser | undefined): Promise<MeResponse> {
    if (!current) {
      throw new UnauthorizedException();
    }
    const user = await this.usersService.findActiveById(current.userId);
    if (!user) {
      throw new UnauthorizedException();
    }
    const permissions = await this.usersService.getEffectivePermissions(current.userId);
    return { user: this.authService.toAuthUser(user), permissions };
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(REFRESH_TOKEN_COOKIE, token, {
      httpOnly: true,
      secure: this.config.get<string>('COOKIE_SECURE') === 'true',
      sameSite: 'lax',
      path: REFRESH_COOKIE_PATH,
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_TOKEN_COOKIE, {
      httpOnly: true,
      secure: this.config.get<string>('COOKIE_SECURE') === 'true',
      sameSite: 'lax',
      path: REFRESH_COOKIE_PATH,
    });
  }
}
