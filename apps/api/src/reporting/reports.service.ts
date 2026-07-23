import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Report } from '@erp/database';
import type { Paginated, ReportFilters, ReportResult } from '@erp/contracts';

import { PrismaService } from '../prisma/prisma.service';
import { REPORT_RUNNERS } from './report-runners';
import type { CreateReportInput, UpdateReportInput } from './reporting.schemas';

/** Client-facing shape of a saved Report definition. */
export interface ReportDto {
  id: string;
  name: string;
  reportType: string;
  filters: ReportFilters;
  createdAt: string;
  updatedAt: string;
}

function toReportDto(row: Report): ReportDto {
  return {
    id: row.id,
    name: row.name,
    reportType: row.reportType,
    filters: (row.filtersJson as ReportFilters | null) ?? {},
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Saved Report CRUD, plus `run()` which dispatches to the report type's
 * runner (see `report-runners/`) for a live query — a Report row is a saved
 * config, never a cached result. Company-scoped throughout: reads/writes
 * filter by the caller's companyId, cross-company (or missing) id -> 404.
 */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string, query: { page: number; pageSize: number }): Promise<Paginated<ReportDto>> {
    const { page, pageSize } = query;
    const where: Prisma.ReportWhereInput = { companyId };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.report.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.report.count({ where }),
    ]);

    return {
      data: rows.map(toReportDto),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async get(companyId: string, id: string): Promise<ReportDto> {
    const row = await this.prisma.report.findFirst({ where: { id, companyId } });
    if (!row) {
      throw new NotFoundException(`Report ${id} not found`);
    }
    return toReportDto(row);
  }

  async create(companyId: string, userId: string, input: CreateReportInput): Promise<ReportDto> {
    try {
      const row = await this.prisma.report.create({
        data: {
          companyId,
          name: input.name,
          reportType: input.reportType,
          filtersJson: input.filters ?? Prisma.JsonNull,
          createdById: userId,
          updatedById: userId,
        },
      });
      return toReportDto(row);
    } catch (error) {
      throw this.mapUniqueViolation(error, input.name);
    }
  }

  async update(companyId: string, userId: string, id: string, input: UpdateReportInput): Promise<ReportDto> {
    await this.ensureExists(companyId, id);
    try {
      const row = await this.prisma.report.update({
        where: { id },
        data: {
          name: input.name,
          reportType: input.reportType,
          filtersJson: input.filters === undefined ? undefined : (input.filters ?? Prisma.JsonNull),
          updatedById: userId,
        },
      });
      return toReportDto(row);
    } catch (error) {
      throw this.mapUniqueViolation(error, input.name ?? id);
    }
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.ensureExists(companyId, id);
    await this.prisma.report.delete({ where: { id } });
  }

  /** Run a saved report's query live against current data. */
  async run(companyId: string, id: string): Promise<ReportResult> {
    const row = await this.prisma.report.findFirst({ where: { id, companyId } });
    if (!row) {
      throw new NotFoundException(`Report ${id} not found`);
    }
    const runner = REPORT_RUNNERS[row.reportType as keyof typeof REPORT_RUNNERS];
    const filters = (row.filtersJson as ReportFilters | null) ?? {};
    return runner(this.prisma, companyId, filters);
  }

  private async ensureExists(companyId: string, id: string): Promise<void> {
    const found = await this.prisma.report.findFirst({ where: { id, companyId }, select: { id: true } });
    if (!found) {
      throw new NotFoundException(`Report ${id} not found`);
    }
  }

  private mapUniqueViolation(error: unknown, name: string): unknown {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new ConflictException(`A report named "${name}" already exists`);
    }
    return error;
  }
}
