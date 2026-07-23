import type { ReportResult } from '@erp/contracts';
import type { ReportRunner } from './report-runner.types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const runOpenInvoices: ReportRunner = async (prisma, companyId): Promise<ReportResult> => {
  const invoices = await prisma.invoice.findMany({
    where: { companyId, status: { not: 'paid' } },
    include: { salesOrder: { include: { customer: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const now = Date.now();
  const rows = invoices.map((invoice) => ({
    'Invoice #': invoice.invoiceNumber,
    Customer: invoice.salesOrder.customer.name,
    Status: invoice.status,
    Amount: invoice.totalAmount.toFixed(2),
    'Age (days)': Math.floor((now - invoice.createdAt.getTime()) / MS_PER_DAY),
  }));

  return { columns: ['Invoice #', 'Customer', 'Status', 'Amount', 'Age (days)'], rows };
};
