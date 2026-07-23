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
   * Find a user by email. Email is unique per company; this single-company
   * install resolves the first match, which is sufficient for login.
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
