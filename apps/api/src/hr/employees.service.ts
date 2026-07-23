import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Employee } from '@erp/database';
import type { Paginated } from '@erp/contracts';

import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateEmployeeInput,
  EmployeeListQuery,
  UpdateEmployeeInput,
} from './hr.schemas';

/**
 * Client-facing shape of an Employee. Dates are stringified (ISO 8601) the
 * same way products.service.ts stringifies Decimals — a stable wire
 * contract, never relying on default JSON serialization of a Date/Decimal.
 */
export interface EmployeeDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string | null;
  department: string | null;
  employmentStatus: string;
  hireDate: string;
  createdAt: string;
  updatedAt: string;
}

export function toEmployeeDto(row: Employee): EmployeeDto {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    jobTitle: row.jobTitle,
    department: row.department,
    employmentStatus: row.employmentStatus,
    hireDate: row.hireDate.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Employee CRUD. Everything is company-scoped: reads/writes filter by the
 * caller's companyId, and a cross-company (or missing) id resolves to 404 —
 * never leaking that the record exists for another company. The
 * `@@unique([companyId, email])` constraint is surfaced as a 409 Conflict.
 */
@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    companyId: string,
    query: EmployeeListQuery,
  ): Promise<Paginated<EmployeeDto>> {
    const { employmentStatus, page, pageSize } = query;
    const where: Prisma.EmployeeWhereInput = {
      companyId,
      ...(employmentStatus ? { employmentStatus } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        where,
        orderBy: { lastName: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.employee.count({ where }),
    ]);

    return {
      data: rows.map(toEmployeeDto),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async get(companyId: string, id: string): Promise<EmployeeDto> {
    const row = await this.prisma.employee.findFirst({ where: { id, companyId } });
    if (!row) {
      throw new NotFoundException(`Employee ${id} not found`);
    }
    return toEmployeeDto(row);
  }

  async create(
    companyId: string,
    userId: string,
    input: CreateEmployeeInput,
  ): Promise<EmployeeDto> {
    try {
      const row = await this.prisma.employee.create({
        data: {
          companyId,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          jobTitle: input.jobTitle,
          department: input.department,
          employmentStatus: input.employmentStatus ?? 'active',
          hireDate: input.hireDate ?? new Date(),
          createdById: userId,
          updatedById: userId,
        },
      });
      return toEmployeeDto(row);
    } catch (error) {
      throw this.mapUniqueViolation(error, input.email);
    }
  }

  async update(
    companyId: string,
    userId: string,
    id: string,
    input: UpdateEmployeeInput,
  ): Promise<EmployeeDto> {
    await this.ensureExists(companyId, id);
    try {
      const row = await this.prisma.employee.update({
        where: { id },
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          jobTitle: input.jobTitle,
          department: input.department,
          employmentStatus: input.employmentStatus,
          hireDate: input.hireDate,
          updatedById: userId,
        },
      });
      return toEmployeeDto(row);
    } catch (error) {
      throw this.mapUniqueViolation(error, input.email ?? id);
    }
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.ensureExists(companyId, id);
    // No dependents to guard against for this stub (see hr.prisma docblock).
    await this.prisma.employee.delete({ where: { id } });
  }

  /** Assert an employee exists for this company, else 404 (no existence leak). */
  private async ensureExists(companyId: string, id: string): Promise<void> {
    const found = await this.prisma.employee.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    if (!found) {
      throw new NotFoundException(`Employee ${id} not found`);
    }
  }

  /** Map a Prisma unique-constraint violation (duplicate email) to a 409. */
  private mapUniqueViolation(error: unknown, email: string): unknown {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException(`An employee with email "${email}" already exists`);
    }
    return error;
  }
}
