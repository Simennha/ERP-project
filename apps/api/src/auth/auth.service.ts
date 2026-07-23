import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { User } from '@erp/database';
import type { AuthUser } from '@erp/contracts';
import { UsersService } from '../users/users.service';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** Validate email/password with bcrypt. Throws 401 on any mismatch. */
  async validateCredentials(email: string, password: string): Promise<User> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return user;
  }

  /** Log in: validate credentials and issue an access + refresh token pair. */
  async login(email: string, password: string): Promise<IssuedTokens & { user: AuthUser }> {
    const user = await this.validateCredentials(email, password);
    const tokens = await this.issueTokens(user);
    return { ...tokens, user: this.toAuthUser(user) };
  }

  /** Rotate tokens for a still-active user (called by /auth/refresh). */
  async refresh(userId: string): Promise<IssuedTokens> {
    const user = await this.usersService.findActiveById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found or inactive');
    }
    return this.issueTokens(user);
  }

  /** Sign a fresh access token (15m) and refresh token (7d). */
  async issueTokens(user: User): Promise<IssuedTokens> {
    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, companyId: user.companyId, email: user.email },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m',
      },
    );
    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, companyId: user.companyId, tokenType: 'refresh' },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d',
      },
    );
    return { accessToken, refreshToken };
  }

  /** Map a DB user to the safe, client-facing AuthUser shape (no secrets). */
  toAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      companyId: user.companyId,
      departmentId: user.departmentId,
      isActive: user.isActive,
    };
  }
}
