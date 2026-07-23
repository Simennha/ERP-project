import { Injectable } from '@nestjs/common';
import type { User } from '@erp/database';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Find an active user by id, or null. */
  findActiveById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { id, isActive: true } });
  }

  /**
   * Find a user by email — used by login, where the caller has nothing to
   * scope by yet (that's the whole problem login solves).
   *
   * `User.email` is unique only PER COMPANY (`@@unique([companyId, email])`
   * in schema.prisma), not globally. This resolves the first match across
   * ALL companies, which is only safe because there is currently no way to
   * create a second `Company` anywhere in this codebase (no signup flow —
   * every company today is the one row `prisma/seed.ts` creates). If that
   * ever changes, this becomes a real bug: two companies with a same-email
   * user would make login resolve to whichever one happens to match first,
   * not necessarily the one the caller meant. Before adding any company
   * signup/onboarding flow, revisit this — e.g. require the login form to
   * disambiguate by company (subdomain/slug) rather than email alone.
   */
  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { email } });
  }

  /**
   * Compute a user's effective permission keys by joining
   * UserRole -> Role -> RolePermission -> Permission and de-duplicating.
   */
  async getEffectivePermissions(userId: string): Promise<string[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    const keys = new Set<string>();
    for (const userRole of userRoles) {
      for (const rolePermission of userRole.role.rolePermissions) {
        keys.add(rolePermission.permission.key);
      }
    }
    return Array.from(keys);
  }
}
