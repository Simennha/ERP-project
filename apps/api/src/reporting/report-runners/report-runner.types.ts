import type { ReportFilters, ReportResult } from '@erp/contracts';
import type { PrismaService } from '../../prisma/prisma.service';

/** One report type's query implementation. Pure function: no side effects. */
export type ReportRunner = (
  prisma: PrismaService,
  companyId: string,
  filters: ReportFilters,
) => Promise<ReportResult>;

/** Parses `filters.dateFrom`/`dateTo` into a Prisma-ready date range, if present. */
export function dateRange(filters: ReportFilters): { gte?: Date; lte?: Date } | undefined {
  const gte = filters.dateFrom ? new Date(filters.dateFrom) : undefined;
  const lte = filters.dateTo ? new Date(filters.dateTo) : undefined;
  if (!gte && !lte) return undefined;
  return { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
}
