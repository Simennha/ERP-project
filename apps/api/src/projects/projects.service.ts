import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Project } from '@erp/database';
import type { Paginated } from '@erp/contracts';

import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateProjectInput,
  ProjectListQuery,
  UpdateProjectInput,
} from './projects.schemas';

/**
 * Client-facing shape of a Project. `startDate`/`endDate` are nullable Prisma
 * `DateTime` fields — converted to ISO strings (or `null`) rather than left as
 * `Date` objects, matching the rest of the codebase's DTO convention.
 */
export interface ProjectDto {
  id: string;
  name: string;
  code: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toProjectDto(row: Project): ProjectDto {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    status: row.status,
    startDate: row.startDate ? row.startDate.toISOString() : null,
    endDate: row.endDate ? row.endDate.toISOString() : null,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Project CRUD. Everything is company-scoped: reads/writes filter by the
 * caller's companyId, and a cross-company (or missing) id resolves to 404 —
 * never leaking that the record exists for another company. The
 * `@@unique([companyId, code])` constraint is surfaced as a 409 Conflict.
 */
@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    companyId: string,
    query: ProjectListQuery,
  ): Promise<Paginated<ProjectDto>> {
    const { status, page, pageSize } = query;
    const where: Prisma.ProjectWhereInput = {
      companyId,
      ...(status ? { status } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      data: rows.map(toProjectDto),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async get(companyId: string, id: string): Promise<ProjectDto> {
    const row = await this.prisma.project.findFirst({ where: { id, companyId } });
    if (!row) {
      throw new NotFoundException(`Project ${id} not found`);
    }
    return toProjectDto(row);
  }

  async create(
    companyId: string,
    userId: string,
    input: CreateProjectInput,
  ): Promise<ProjectDto> {
    try {
      const row = await this.prisma.project.create({
        data: {
          companyId,
          name: input.name,
          code: input.code,
          // undefined -> DB default ("planned")
          status: input.status ?? 'planned',
          startDate: input.startDate,
          endDate: input.endDate,
          description: input.description,
          createdById: userId,
          updatedById: userId,
        },
      });
      return toProjectDto(row);
    } catch (error) {
      throw this.mapUniqueViolation(error, input.code);
    }
  }

  async update(
    companyId: string,
    userId: string,
    id: string,
    input: UpdateProjectInput,
  ): Promise<ProjectDto> {
    await this.ensureExists(companyId, id);
    try {
      const row = await this.prisma.project.update({
        where: { id },
        data: {
          name: input.name,
          code: input.code,
          status: input.status,
          startDate: input.startDate,
          endDate: input.endDate,
          description: input.description,
          updatedById: userId,
        },
      });
      return toProjectDto(row);
    } catch (error) {
      throw this.mapUniqueViolation(error, input.code ?? id);
    }
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.ensureExists(companyId, id);
    // No dependents to guard against for this stub — hard delete.
    await this.prisma.project.delete({ where: { id } });
  }

  /** Assert a project exists for this company, else 404 (no existence leak). */
  private async ensureExists(companyId: string, id: string): Promise<void> {
    const found = await this.prisma.project.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    if (!found) {
      throw new NotFoundException(`Project ${id} not found`);
    }
  }

  /** Map a Prisma unique-constraint violation (duplicate code) to a 409. */
  private mapUniqueViolation(error: unknown, code: string): unknown {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException(`A project with code "${code}" already exists`);
    }
    return error;
  }
}
