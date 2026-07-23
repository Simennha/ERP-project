import { SetMetadata, type CustomDecorator } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route (or controller) as public, bypassing the global JwtAuthGuard.
 * Used for /auth/login, /auth/refresh, /auth/logout, and health checks.
 */
export const Public = (): CustomDecorator => SetMetadata(IS_PUBLIC_KEY, true);
