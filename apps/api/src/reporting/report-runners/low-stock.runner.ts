import type { ReportResult } from '@erp/contracts';
import type { ReportRunner } from './report-runner.types';

export const runLowStock: ReportRunner = async (prisma, companyId): Promise<ReportResult> => {
  const stockItems = await prisma.stockItem.findMany({
    where: { companyId, reorderPoint: { gt: 0 } },
    select: {
      quantityOnHand: true,
      quantityReserved: true,
      reorderPoint: true,
      product: { select: { sku: true, name: true } },
      warehouse: { select: { name: true } },
    },
  });

  const rows = stockItems
    .filter((item) => item.quantityOnHand - item.quantityReserved <= item.reorderPoint)
    .map((item) => ({
      SKU: item.product.sku,
      Product: item.product.name,
      Warehouse: item.warehouse.name,
      Available: item.quantityOnHand - item.quantityReserved,
      'Reorder Point': item.reorderPoint,
    }))
    .sort((a, b) => a.Available - b.Available);

  return { columns: ['SKU', 'Product', 'Warehouse', 'Available', 'Reorder Point'], rows };
};
