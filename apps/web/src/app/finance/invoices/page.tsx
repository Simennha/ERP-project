'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PERMISSIONS } from '@erp/contracts';
import { Button, DataTable, StatusBadge, buttonVariants, type DataTableColumn, type StatusTone } from '@erp/ui';
import { useAuth } from '@/lib/auth/auth-context';
import { RequirePermissionPage } from '@/lib/auth/require-permission-page';
import { listInvoices, type InvoiceDto, type Paginated } from '@/lib/finance/api';

const PAGE_SIZE = 25;

const STATUS_TONE: Record<string, StatusTone> = {
  draft: 'neutral',
  sent: 'info',
  paid: 'success',
};

function InvoicesContent() {
  const { getAccessToken, hasPermission } = useAuth();
  const canCreate = hasPermission(PERMISSIONS.FINANCE_INVOICE_CREATE);

  const [result, setResult] = useState<Paginated<InvoiceDto> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listInvoices(getAccessToken(), { page, pageSize: PAGE_SIZE });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: Array<DataTableColumn<InvoiceDto>> = [
    {
      key: 'invoiceNumber',
      header: 'Invoice #',
      cell: (row) => (
        <Link href={`/finance/invoices/${row.id}`} className="font-medium hover:underline">
          {row.invoiceNumber}
        </Link>
      ),
    },
    {
      key: 'salesOrderNumber',
      header: 'Sales order',
      cell: (row) => <code className="text-xs">{row.salesOrderNumber}</code>,
    },
    { key: 'customerName', header: 'Customer', cell: (row) => row.customerName },
    {
      key: 'totalAmount',
      header: 'Amount',
      className: 'text-right tabular-nums',
      cell: (row) => row.totalAmount,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <StatusBadge label={row.status} tone={STATUS_TONE[row.status] ?? 'neutral'} />,
    },
    {
      key: 'createdAt',
      header: 'Created',
      cell: (row) => new Date(row.createdAt).toLocaleDateString(),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground">Invoices billed against your sales orders.</p>
        </div>
        {canCreate ? (
          <Link href="/finance/invoices/new" className={buttonVariants()}>
            New Invoice
          </Link>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <DataTable
        columns={columns}
        data={result?.data ?? []}
        getRowId={(row) => row.id}
        emptyMessage={loading ? 'Loading…' : 'No invoices found'}
      />

      {result && result.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {result.page} of {result.totalPages} · {result.total} total
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= result.totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function InvoicesPage() {
  return (
    <RequirePermissionPage permission={PERMISSIONS.FINANCE_INVOICE_READ}>
      <InvoicesContent />
    </RequirePermissionPage>
  );
}
