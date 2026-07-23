'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PERMISSIONS } from '@erp/contracts';
import { Button, DataTable, type DataTableColumn } from '@erp/ui';
import { useAuth } from '@/lib/auth/auth-context';
import {
  listStock,
  listWarehouses,
  type Paginated,
  type StockItemDto,
  type WarehouseDto,
} from '@/lib/inventory/api';
import { AdjustDialog } from './adjust-dialog';

const PAGE_SIZE = 25;

function StockContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { getAccessToken, hasPermission } = useAuth();

  const canAdjust = hasPermission(PERMISSIONS.INVENTORY_STOCK_ADJUST);
  const canListWarehouses = hasPermission(PERMISSIONS.INVENTORY_WAREHOUSE_MANAGE);

  // Filters come straight from the URL query string (?warehouseId=&lowStock=).
  // No shared useTableFilters hook exists yet — reading useSearchParams directly
  // here is deliberate (see report). A real hook should be extracted in the
  // dashboard phase once more pages share this pattern.
  const warehouseId = searchParams.get('warehouseId') ?? '';
  const lowStockParam = searchParams.get('lowStock');
  const lowStock = lowStockParam === 'true' || lowStockParam === '1';

  const [result, setResult] = useState<Paginated<StockItemDto> | null>(null);
  const [warehouses, setWarehouses] = useState<WarehouseDto[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<StockItemDto | null>(null);

  // Reset to the first page whenever the filters change.
  useEffect(() => {
    setPage(1);
  }, [warehouseId, lowStock]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(
        await listStock(getAccessToken(), {
          warehouseId: warehouseId || undefined,
          lowStock: lowStock || undefined,
          page,
          pageSize: PAGE_SIZE,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stock');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, warehouseId, lowStock, page]);

  useEffect(() => {
    void load();
  }, [load]);

  // Populate the warehouse filter dropdown (best-effort: needs warehouse:manage).
  useEffect(() => {
    if (!canListWarehouses) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const data = await listWarehouses(getAccessToken(), { pageSize: 200 });
        if (!cancelled) setWarehouses(data.data);
      } catch {
        // Non-fatal: fall back to the URL filter without a dropdown.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getAccessToken, canListWarehouses]);

  function updateQuery(next: { warehouseId?: string | null; lowStock?: boolean }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.warehouseId !== undefined) {
      if (next.warehouseId) params.set('warehouseId', next.warehouseId);
      else params.delete('warehouseId');
    }
    if (next.lowStock !== undefined) {
      if (next.lowStock) params.set('lowStock', 'true');
      else params.delete('lowStock');
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const columns: Array<DataTableColumn<StockItemDto>> = [
    {
      key: 'sku',
      header: 'SKU',
      cell: (row) => <code className="text-xs">{row.productSku}</code>,
    },
    {
      key: 'product',
      header: 'Product',
      cell: (row) => (
        <Link
          href={`/inventory/stock/${row.productId}/movements?warehouseId=${row.warehouseId}`}
          className="font-medium hover:underline"
        >
          {row.productName}
        </Link>
      ),
    },
    { key: 'warehouse', header: 'Warehouse', cell: (row) => row.warehouseName },
    {
      key: 'onHand',
      header: 'On hand',
      className: 'text-right tabular-nums',
      cell: (row) => row.quantityOnHand,
    },
    {
      key: 'reserved',
      header: 'Reserved',
      className: 'text-right tabular-nums',
      cell: (row) => row.quantityReserved,
    },
    {
      key: 'available',
      header: 'Available',
      className: 'text-right tabular-nums',
      cell: (row) => (
        <span className={row.isLow ? 'font-semibold text-destructive' : undefined}>
          {row.available}
        </span>
      ),
    },
    {
      key: 'reorderPoint',
      header: 'Reorder pt',
      className: 'text-right tabular-nums',
      cell: (row) => row.reorderPoint,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) =>
        row.isLow ? (
          <span className="rounded bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
            Low
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">OK</span>
        ),
    },
  ];

  if (canAdjust) {
    columns.push({
      key: 'actions',
      header: '',
      className: 'text-right',
      cell: (row) => (
        <Button variant="outline" size="sm" onClick={() => setAdjustTarget(row)}>
          Adjust
        </Button>
      ),
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Stock levels</h1>
        <p className="text-muted-foreground">
          On-hand, reserved and available quantities per product and warehouse.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {warehouses.length > 0 ? (
          <select
            value={warehouseId}
            onChange={(e) => updateQuery({ warehouseId: e.target.value || null })}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Filter by warehouse"
          >
            <option value="">All warehouses</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        ) : warehouseId ? (
          <span className="text-sm text-muted-foreground">
            Filtered to warehouse <code>{warehouseId}</code>
          </span>
        ) : null}

        <Button
          variant={lowStock ? 'default' : 'outline'}
          size="sm"
          onClick={() => updateQuery({ lowStock: !lowStock })}
        >
          {lowStock ? 'Showing low stock only' : 'Show low stock only'}
        </Button>

        {(warehouseId || lowStock) && warehouses.length === 0 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(pathname)}
          >
            Clear filters
          </Button>
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
        rowClassName={(row) => (row.isLow ? 'bg-destructive/5' : undefined)}
        emptyMessage={loading ? 'Loading…' : 'No stock rows found'}
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

      {adjustTarget ? (
        <AdjustDialog
          row={adjustTarget}
          token={getAccessToken()}
          onClose={() => setAdjustTarget(null)}
          onDone={() => {
            setAdjustTarget(null);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}

export default function StockPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
      <StockContent />
    </Suspense>
  );
}
