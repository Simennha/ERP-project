import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Warehouse } from '@erp/database';
import type { Paginated, PaginationQuery } from '@erp/contracts';

import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateWarehouseInput,
  UpdateWarehouseInput,
} from './inventory.schemas';

/** Client-facing shape of a Warehouse (no Decimal fields — plain scalars). */
export interface WarehouseDto {
  id: string;
  name: string;
  code: string;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function toWarehouseDto(row: Warehouse): WarehouseDto {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    address: row.address,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Warehouse CRUD. Company-scoped (cross-company/missing id -> 404). Warehouses
 * are a small, admin-configured list, so a single `INVENTORY_WAREHOUSE_MANAGE`
 * permission gates both reads and writes (there is no separate read key). The
 * `@@unique([companyId, code])` constraint surfaces as a 409 Conflict.
 */
@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    companyId: string,
    query: PaginationQuery,
  ): Promise<Paginated<WarehouseDto>> {
    const { page, pageSize } = query;
    const where: Prisma.WarehouseWhereInput = { companyId };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.warehouse.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.warehouse.count({ where }),
    ]);

    return {
      data: rows.map(toWarehouseDto),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async get(companyId: string, id: string): Promise<WarehouseDto> {
    const row = await this.prisma.warehouse.findFirst({ where: { id, companyId } });
    if (!row) {
      throw new NotFoundException(`Warehouse ${id} not found`);
    }
    return toWarehouseDto(row);
  }

  async create(
    companyId: string,
    userId: string,
    input: CreateWarehouseInput,
  ): Promise<WarehouseDto> {
    try {
      const row = await this.prisma.warehouse.create({
        data: {
          companyId,
          name: input.name,
          code: input.code,
          address: input.address,
          isActive: input.isActive ?? true,
          createdById: userId,
          updatedById: userId,
        },
      });
      return toWarehouseDto(row);
    } catch (error) {
      throw this.mapUniqueViolation(error, input.code);
    }
  }

  async update(
    companyId: string,
    userId: string,
    id: string,
    input: UpdateWarehouseInput,
  ): Promise<WarehouseDto> {
    await this.ensureExists(companyId, id);
    try {
      const row = await this.prisma.warehouse.update({
        where: { id },
        data: {
          name: input.name,
          code: input.code,
          address: input.address,
          isActive: input.isActive,
          updatedById: userId,
        },
      });
      return toWarehouseDto(row);
    } catch (error) {
      throw this.mapUniqueViolation(error, input.code ?? id);
    }
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.ensureExists(companyId, id);
    // Hard delete; cascades StockItem/StockMovement rows for this warehouse
    // (onDelete: Cascade in inventory.prisma).
    await this.prisma.warehouse.delete({ where: { id } });
  }

  private async ensureExists(companyId: string, id: string): Promise<void> {
    const found = await this.prisma.warehouse.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    if (!found) {
      throw new NotFoundException(`Warehouse ${id} not found`);
    }
  }

  private mapUniqueViolation(error: unknown, code: string): unknown {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException(`A warehouse with code "${code}" already exists`);
    }
    return error;
  }
}
