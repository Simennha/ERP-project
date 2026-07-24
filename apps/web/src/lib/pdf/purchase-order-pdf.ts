import type { PurchaseOrderDto } from '@/lib/procurement/api';
import { addBrandedTable, addDetailBlock, addTotalLine, createBrandedDocument, savePdf, slugForFilename } from './pdf-utils';

function formatMoney(value: string): string {
  const n = Number(value);
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : value;
}

/** Renders a PurchaseOrderDto (as already loaded on the PO detail page) to a PDF and downloads it. */
export function exportPurchaseOrderPdf(order: PurchaseOrderDto): void {
  const doc = createBrandedDocument(`Purchase Order ${order.poNumber}`, `Status: ${order.status}`);

  let y = addDetailBlock(doc, 100, [
    ['Vendor', order.vendorName],
    ['Order date', new Date(order.orderDate).toLocaleDateString()],
    ['Expected date', order.expectedDate ? new Date(order.expectedDate).toLocaleDateString() : '—'],
    ...(order.notes ? ([['Notes', order.notes]] as Array<[string, string]>) : []),
  ]);

  y = addBrandedTable(
    doc,
    y,
    ['SKU', 'Product', 'Warehouse', 'Ordered', 'Received', 'Unit cost', 'Line total'],
    order.lines.map((line) => [
      line.productSku,
      line.productName || line.productId,
      line.warehouseName || line.warehouseId,
      String(line.quantityOrdered),
      String(line.quantityReceived),
      formatMoney(line.unitCost),
      formatMoney(line.lineTotal),
    ]),
    { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
  );

  addTotalLine(doc, y, 'Total', formatMoney(order.totalAmount));

  savePdf(doc, `purchase-order-${slugForFilename(order.poNumber)}`);
}
