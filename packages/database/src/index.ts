/**
 * Generated Prisma client wrapper.
 *
 * Re-exports the full generated client (PrismaClient + all model types/enums)
 * so the rest of the monorepo imports database types from a single package
 * (`@erp/database`) rather than from `@prisma/client` directly.
 *
 * Also exposes a lazily-instantiated singleton for scripts/tools. The NestJS
 * app does NOT use this singleton — it manages its own PrismaService lifecycle
 * (see apps/api/src/prisma/prisma.service.ts).
 */
import { PrismaClient } from '@prisma/client';

export * from '@prisma/client';

/** Create a new PrismaClient with sensible logging defaults. */
export function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

// Cache a single client across hot-reloads in dev to avoid exhausting
// connections. Not used by the Nest app (which owns its own instance).
const globalForPrisma = globalThis as unknown as { __erpPrisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.__erpPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__erpPrisma = prisma;
}
