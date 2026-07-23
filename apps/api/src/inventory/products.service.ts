import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Product } from '@erp/database';
import type { Paginated } from '@erp/contracts';

import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateProductInput,
  ProductListQuery,
  UpdateProductInput,
} from './inventory.schemas';

/**
 * Client-facing shape of a Product.
 *
 * `costPrice`/`salePrice` are Prisma `Decimal @db.Decimal(12,2)` values. At
 * runtime Prisma represents them as Decimal.js objects, which do NOT serialize
 * to a clean number automatically. We convert every money field EXPLICITLY to a
 * fixed 2-decimal string (`.toFixed(2)`) so the wire contract is a stable,
 * precision-safe string like "10.00" — never a float that could drift, and
 * never "whatever Decimal.toJSON() happens to emit". Quantities are plain ints.
 */
export interface ProductDto {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  uom: string;
  costPrice: string;
  salePrice: string;
  category: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function toProductDto(row: Product): ProductDto {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    description: row.description,
    uom: row.uom,
    // Explicit Decimal -> fixed 2dp string (see interface docblock).
    costPrice: row.costPrice.toFixed(2),
    salePrice: row.salePrice.toFixed(2),
    category: row.category,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Product CRUD. Everything is company-scoped: reads/writes filter by the
 * caller's companyId, and a cross-company (or missing) id resolves to 404 —
 * never leaking that the record exists for another company. The
 * `@@unique([companyId, sku])` constraint is surfaced as a 409 Conflict.
 */
@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    companyId: string,
    query: ProductListQuery,
  ): Promise<Paginated<ProductDto>> {
    const { category, page, pageSize } = query;
    const where: Prisma.ProductWhereInput = {
      companyId,
      ...(category ? { category } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: rows.map(toProductDto),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async get(companyId: string, id: string): Promise<ProductDto> {
    const row = await this.prisma.product.findFirst({ where: { id, companyId } });
    if (!row) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    return toProductDto(row);
  }

  async create(
    companyId: string,
    userId: string,
    input: CreateProductInput,
  ): Promise<ProductDto> {
    try {
      const row = await this.prisma.product.create({
        data: {
          companyId,
          sku: input.sku,
          name: input.name,
          description: input.description,
          // undefined -> DB default ("each")
          uom: input.uom,
          costPrice: input.costPrice,
          salePrice: input.salePrice,
          category: input.category,
          isActive: input.isActive ?? true,
          createdById: userId,
          updatedById: userId,
        },
      });
      return toProductDto(row);
    } catch (error) {
      throw this.mapUniqueViolation(error, input.sku);
    }
  }

  async update(
    companyId: string,
    userId: string,
    id: string,
    input: UpdateProductInput,
  ): Promise<ProductDto> {
    await this.ensureExists(companyId, id);
    try {
      const row = await this.prisma.product.update({
        where: { id },
        data: {
          sku: input.sku,
          name: input.name,
          description: input.description,
          uom: input.uom,
          costPrice: input.costPrice,
          salePrice: input.salePrice,
          category: input.category,
          isActive: input.isActive,
          updatedById: userId,
        },
      });
      return toProductDto(row);
    } catch (error) {
      throw this.mapUniqueViolation(error, input.sku ?? id);
    }
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.ensureExists(companyId, id);
    // Per inventory.prisma, deleting a Product cascades its StockItem and
    // StockMovement rows (onDelete: Cascade). This is a hard delete; callers
    // that want to keep history should set isActive=false via PATCH instead.
    await this.prisma.product.delete({ where: { id } });
  }

  /** Assert a product exists for this company, else 404 (no existence leak). */
  private async ensureExists(companyId: string, id: string): Promise<void> {
    const found = await this.prisma.product.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    if (!found) {
      throw new NotFoundException(`Product ${id} not found`);
    }
  }

  /** Map a Prisma unique-constraint violation (duplicate SKU) to a 409. */
  private mapUniqueViolation(error: unknown, sku: string): unknown {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException(`A product with SKU "${sku}" already exists`);
    }
    return error;
  }
}
