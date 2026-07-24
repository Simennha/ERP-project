import type { SalesOrderDetail } from '@/lib/sales/api-client';
import { addBrandedTable, addDetailBlock, addTotalLine, createBrandedDocument, savePdf, slugForFilename } from './pdf-utils';

function formatMoney(value: string): string {
  const n = Number(value);
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : value;
}

/** Renders a SalesOrderDetail (as already loaded on the order detail page) to a PDF and downloads it. */
export function exportSalesOrderPdf(order: SalesOrderDetail): void {
  const doc = createBrandedDocument(`Sales Order ${order.orderNumber}`, `Status: ${order.status}`);

  let y = addDetailBlock(doc, 100, [
    ['Customer', order.customer?.name ?? '—'],
    ['Email', order.customer?.email ?? '—'],
    ['Phone', order.customer?.phone ?? '—'],
    ['Order date', new Date(order.orderDate).toLocaleDateString()],
  ]);

  y = addBrandedTable(
    doc,
    y,
    ['SKU', 'Product', 'Qty', 'Unit price', 'Line total'],
    order.lines.map((line) => [
      line.productSku,
      line.productName || line.productId,
      String(line.quantity),
      formatMoney(line.unitPrice),
      formatMoney(line.lineTotal),
    ]),
    { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
  );

  addTotalLine(doc, y, 'Total', formatMoney(order.totalAmount));

  savePdf(doc, `sales-order-${slugForFilename(order.orderNumber)}`);
}
