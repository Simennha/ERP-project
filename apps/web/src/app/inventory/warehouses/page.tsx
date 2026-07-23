'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PERMISSIONS } from '@erp/contracts';
import { Button, DataTable, buttonVariants, type DataTableColumn } from '@erp/ui';
import { useAuth } from '@/lib/auth/auth-context';
import { listWarehouses, type Paginated, type WarehouseDto } from '@/lib/inventory/api';

const PAGE_SIZE = 25;

export default function WarehousesPage() {
  const { getAccessToken, hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.INVENTORY_WAREHOUSE_MANAGE);

  const [result, setResult] = useState<Paginated<WarehouseDto> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await listWarehouses(getAccessToken(), { page, pageSize: PAGE_SIZE }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load warehouses');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: Array<DataTableColumn<WarehouseDto>> = [
    {
      key: 'code',
      header: 'Code',
      cell: (row) => <code className="text-xs">{row.code}</code>,
    },
    {
      key: 'name',
      header: 'Name',
      cell: (row) =>
        canManage ? (
          <Link href={`/inventory/warehouses/${row.id}`} className="font-medium hover:underline">
            {row.name}
          </Link>
        ) : (
          <span className="font-medium">{row.name}</span>
        ),
    },
    {
      key: 'address',
      header: 'Address',
      cell: (row) => row.address ?? <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'isActive',
      header: 'Status',
      cell: (row) =>
        row.isActive ? (
          <span className="text-emerald-600 dark:text-emerald-400">Active</span>
        ) : (
          <span className="text-muted-foreground">Inactive</span>
        ),
    },
    {
      key: 'stock',
      header: '',
      className: 'text-right',
      cell: (row) => (
        <Link
          href={`/inventory/stock?warehouseId=${row.id}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          View stock
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Warehouses</h1>
          <p className="text-muted-foreground">Stock locations for your company.</p>
        </div>
        {canManage ? (
          <Link href="/inventory/warehouses/new" className={buttonVariants()}>
            New Warehouse
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
        emptyMessage={loading ? 'Loading…' : 'No warehouses found'}
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
