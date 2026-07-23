import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { toCustomerDto, type CustomerDto } from './sales.dto';
import type { CreateCustomerInput, UpdateCustomerInput } from './customers.schemas';

/**
 * CRUD service for Customer. Everything is company-scoped: reads/writes filter
 * by the caller's companyId and a cross-company id resolves to 404 (never leaks
 * existence). All money-free, so DTOs only stringify timestamps.
 */
@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string): Promise<CustomerDto[]> {
    const rows = await this.prisma.customer.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toCustomerDto);
  }

  async get(companyId: string, id: string): Promise<CustomerDto> {
    const customer = await this.prisma.customer.findFirst({
      where: { id, companyId },
    });
    if (!customer) {
      throw new NotFoundException(`Customer ${id} not found`);
    }
    return toCustomerDto(customer);
  }

  async create(
    companyId: string,
    userId: string,
    input: CreateCustomerInput,
  ): Promise<CustomerDto> {
    const customer = await this.prisma.customer.create({
      data: {
        companyId,
        name: input.name,
        email: input.email,
        phone: input.phone,
        billingAddress: input.billingAddress,
        isActive: input.isActive ?? true,
        createdById: userId,
        updatedById: userId,
      },
    });
    return toCustomerDto(customer);
  }

  async update(
    companyId: string,
    userId: string,
    id: string,
    input: UpdateCustomerInput,
  ): Promise<CustomerDto> {
    await this.ensureExists(companyId, id);
    const customer = await this.prisma.customer.update({
      where: { id },
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        billingAddress: input.billingAddress,
        isActive: input.isActive,
        updatedById: userId,
      },
    });
    return toCustomerDto(customer);
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.ensureExists(companyId, id);
    // A customer referenced by any sales order cannot be hard-deleted (the FK
    // is onDelete: Restrict). Pre-check so the caller gets a clean 409 instead
    // of a raw FK-violation 500.
    const orderCount = await this.prisma.salesOrder.count({
      where: { companyId, customerId: id },
    });
    if (orderCount > 0) {
      throw new ConflictException(
        `Customer ${id} has ${orderCount} sales order(s) and cannot be deleted`,
      );
    }
    await this.prisma.customer.delete({ where: { id } });
  }

  /** Assert a customer exists for this company, else 404 (no existence leak). */
  private async ensureExists(companyId: string, id: string): Promise<void> {
    const found = await this.prisma.customer.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    if (!found) {
      throw new NotFoundException(`Customer ${id} not found`);
    }
  }
}
