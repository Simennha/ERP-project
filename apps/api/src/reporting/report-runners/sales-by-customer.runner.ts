import type { ReportResult } from '@erp/contracts';
import type { PrismaService } from '../../prisma/prisma.service';
import { dateRange, type ReportRunner } from './report-runner.types';

export const runSalesByCustomer: ReportRunner = async (
  prisma: PrismaService,
  companyId: string,
  filters,
): Promise<ReportResult> => {
  const orderDate = dateRange(filters);

  const grouped = await prisma.salesOrder.groupBy({
    by: ['customerId'],
    where: {
      companyId,
      status: { not: 'cancelled' },
      ...(orderDate ? { orderDate } : {}),
    },
    _count: { _all: true },
    _sum: { totalAmount: true },
  });

  const customers = await prisma.customer.findMany({
    where: { id: { in: grouped.map((g) => g.customerId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(customers.map((c) => [c.id, c.name]));

  const rows = grouped
    .map((g) => ({
      Customer: nameById.get(g.customerId) ?? g.customerId,
      Orders: g._count._all,
      'Total Revenue': (g._sum.totalAmount ?? 0).toString(),
    }))
    .sort((a, b) => Number(b['Total Revenue']) - Number(a['Total Revenue']));

  return { columns: ['Customer', 'Orders', 'Total Revenue'], rows };
};
