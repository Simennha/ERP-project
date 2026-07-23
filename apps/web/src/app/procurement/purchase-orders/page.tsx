'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PERMISSIONS } from '@erp/contracts';
import { Button, DataTable, buttonVariants, type DataTableColumn } from '@erp/ui';
import { useAuth } from '@/lib/auth/auth-context';
import { RequirePermissionPage } from '@/lib/auth/require-permission-page';
import { listPurchaseOrders, type Paginated, type PurchaseOrderDto } from '@/lib/procurement/api';

const PAGE_SIZE = 25;

const STATUS_STYLES: Record<string, string> = {
  draft: 'text-muted-foreground',
  submitted: 'text-blue-600 dark:text-blue-400',
  received: 'text-emerald-600 dark:text-emerald-400',
  cancelled: 'text-destructive',
};

function PurchaseOrdersContent() {
  const { getAccessToken, hasPermission } = useAuth();
  const canCreate = hasPermission(PERMISSIONS.PROCUREMENT_PURCHASE_ORDER_CREATE);

  const [result, setResult] = useState<Paginated<PurchaseOrderDto> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listPurchaseOrders(getAccessToken(), { page, pageSize: PAGE_SIZE });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: Array<DataTableColumn<PurchaseOrderDto>> = [
    {
      key: 'poNumber',
      header: 'PO number',
      cell: (row) => (
        <Link
          href={`/procurement/purchase-orders/${row.id}`}
          className="font-medium hover:underline"
        >
          {row.poNumber}
        </Link>
      ),
    },
    { key: 'vendorName', header: 'Vendor', cell: (row) => row.vendorName },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <span className={STATUS_STYLES[row.status] ?? 'text-foreground'}>{row.status}</span>
      ),
    },
    {
      key: 'totalAmount',
      header: 'Total',
      className: 'text-right tabular-nums',
      cell: (row) => row.totalAmount,
    },
    {
      key: 'orderDate',
      header: 'Order date',
      cell: (row) => new Date(row.orderDate).toLocaleDateString(),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Purchase Orders</h1>
          <p className="text-muted-foreground">Vendor purchase orders for your company.</p>
        </div>
        {canCreate ? (
          <Link href="/procurement/purchase-orders/new" className={buttonVariants()}>
            New Purchase Order
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
        emptyMessage={loading ? 'Loading…' : 'No purchase orders found'}
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

export default function PurchaseOrdersPage() {
  return (
    <RequirePermissionPage permission={PERMISSIONS.PROCUREMENT_PURCHASE_ORDER_READ}>
      <PurchaseOrdersContent />
    </RequirePermissionPage>
  );
}
