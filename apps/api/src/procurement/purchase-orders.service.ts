import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type PurchaseOrder } from '@erp/database';
import type { Paginated } from '@erp/contracts';

import { PrismaService } from '../prisma/prisma.service';
import type {
  CreatePurchaseOrderInput,
  PurchaseOrderListQuery,
  UpdatePurchaseOrderInput,
} from './procurement.schemas';

/**
 * Client-facing shape of a PurchaseOrder.
 *
 * `totalAmount` is a Prisma `Decimal @db.Decimal(12,2)` value. At runtime
 * Prisma represents it as a Decimal.js object, which does NOT serialize to a
 * clean number automatically. We convert it EXPLICITLY to a fixed 2-decimal
 * string (`.toFixed(2)`) so the wire contract is a stable, precision-safe
 * string like "10.00" — never a float that could drift (see
 * products.service.ts's ProductDto docblock for the same convention).
 */
export interface PurchaseOrderDto {
  id: string;
  poNumber: string;
  vendorName: string;
  status: string;
  totalAmount: string;
  orderDate: string;
  expectedDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toPurchaseOrderDto(row: PurchaseOrder): PurchaseOrderDto {
  return {
    id: row.id,
    poNumber: row.poNumber,
    vendorName: row.vendorName,
    status: row.status,
    // Explicit Decimal -> fixed 2dp string (see interface docblock).
    totalAmount: row.totalAmount.toFixed(2),
    orderDate: row.orderDate.toISOString(),
    expectedDate: row.expectedDate ? row.expectedDate.toISOString() : null,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * PurchaseOrder CRUD. Everything is company-scoped: reads/writes filter by
 * the caller's companyId, and a cross-company (or missing) id resolves to 404
 * — never leaking that the record exists for another company. The
 * `@@unique([companyId, poNumber])` constraint is surfaced as a 409 Conflict.
 */
@Injectable()
export class PurchaseOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    companyId: string,
    query: PurchaseOrderListQuery,
  ): Promise<Paginated<PurchaseOrderDto>> {
    const { status, page, pageSize } = query;
    const where: Prisma.PurchaseOrderWhereInput = {
      companyId,
      ...(status ? { status } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.purchaseOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return {
      data: rows.map(toPurchaseOrderDto),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async get(companyId: string, id: string): Promise<PurchaseOrderDto> {
    const row = await this.prisma.purchaseOrder.findFirst({ where: { id, companyId } });
    if (!row) {
      throw new NotFoundException(`Purchase order ${id} not found`);
    }
    return toPurchaseOrderDto(row);
  }

  async create(
    companyId: string,
    userId: string,
    input: CreatePurchaseOrderInput,
  ): Promise<PurchaseOrderDto> {
    try {
      const row = await this.prisma.purchaseOrder.create({
        data: {
          companyId,
          poNumber: input.poNumber,
          vendorName: input.vendorName,
          // undefined -> DB default ("draft")
          status: input.status,
          totalAmount: input.totalAmount,
          // undefined -> DB default (now())
          orderDate: input.orderDate,
          expectedDate: input.expectedDate,
          notes: input.notes,
          createdById: userId,
          updatedById: userId,
        },
      });
      return toPurchaseOrderDto(row);
    } catch (error) {
      throw this.mapUniqueViolation(error, input.poNumber);
    }
  }

  async update(
    companyId: string,
    userId: string,
    id: string,
    input: UpdatePurchaseOrderInput,
  ): Promise<PurchaseOrderDto> {
    await this.ensureExists(companyId, id);
    try {
      const row = await this.prisma.purchaseOrder.update({
        where: { id },
        data: {
          poNumber: input.poNumber,
          vendorName: input.vendorName,
          status: input.status,
          totalAmount: input.totalAmount,
          orderDate: input.orderDate,
          expectedDate: input.expectedDate,
          notes: input.notes,
          updatedById: userId,
        },
      });
      return toPurchaseOrderDto(row);
    } catch (error) {
      throw this.mapUniqueViolation(error, input.poNumber ?? id);
    }
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.ensureExists(companyId, id);
    // No dependents to guard against for this stub (no PurchaseOrderLine yet).
    await this.prisma.purchaseOrder.delete({ where: { id } });
  }

  /** Assert a purchase order exists for this company, else 404 (no existence leak). */
  private async ensureExists(companyId: string, id: string): Promise<void> {
    const found = await this.prisma.purchaseOrder.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    if (!found) {
      throw new NotFoundException(`Purchase order ${id} not found`);
    }
  }

  /** Map a Prisma unique-constraint violation (duplicate PO number) to a 409. */
  private mapUniqueViolation(error: unknown, poNumber: string): unknown {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException(
        `A purchase order with number "${poNumber}" already exists`,
      );
    }
    return error;
  }
}
