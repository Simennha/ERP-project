import type { ReportResult } from '@erp/contracts';
import { dateRange, type ReportRunner } from './report-runner.types';

export const runPurchaseOrdersByVendor: ReportRunner = async (
  prisma,
  companyId,
  filters,
): Promise<ReportResult> => {
  const orderDate = dateRange(filters);

  const grouped = await prisma.purchaseOrder.groupBy({
    by: ['vendorName'],
    where: {
      companyId,
      status: { not: 'cancelled' },
      ...(orderDate ? { orderDate } : {}),
    },
    _count: { _all: true },
    _sum: { totalAmount: true },
  });

  const rows = grouped
    .map((g) => ({
      Vendor: g.vendorName,
      Orders: g._count._all,
      'Total Spend': (g._sum.totalAmount ?? 0).toString(),
    }))
    .sort((a, b) => Number(b['Total Spend']) - Number(a['Total Spend']));

  return { columns: ['Vendor', 'Orders', 'Total Spend'], rows };
};
