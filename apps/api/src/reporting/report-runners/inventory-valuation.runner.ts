import type { ReportResult } from '@erp/contracts';
import type { ReportRunner } from './report-runner.types';

/** Same in-memory aggregation approach as InventoryDashboardWidgetsProvider —
 * `available`/valuation are computed, not stored, so this can't be a single
 * Prisma aggregate (costPrice lives on the related Product). */
export const runInventoryValuation: ReportRunner = async (prisma, companyId): Promise<ReportResult> => {
  const stockItems = await prisma.stockItem.findMany({
    where: { companyId },
    select: {
      quantityOnHand: true,
      product: { select: { costPrice: true } },
      warehouse: { select: { id: true, name: true } },
    },
  });

  const valueByWarehouse = new Map<string, { name: string; value: number }>();
  for (const item of stockItems) {
    const existing = valueByWarehouse.get(item.warehouse.id) ?? { name: item.warehouse.name, value: 0 };
    existing.value += item.quantityOnHand * Number(item.product.costPrice);
    valueByWarehouse.set(item.warehouse.id, existing);
  }

  const rows = Array.from(valueByWarehouse.values())
    .map((w) => ({ Warehouse: w.name, 'Total Value': w.value.toFixed(2) }))
    .sort((a, b) => Number(b['Total Value']) - Number(a['Total Value']));

  return { columns: ['Warehouse', 'Total Value'], rows };
};
