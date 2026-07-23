'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PERMISSIONS } from '@erp/contracts';
import { Button, DataTable, type DataTableColumn } from '@erp/ui';
import { useAuth } from '@/lib/auth/auth-context';
import { RequirePermissionPage } from '@/lib/auth/require-permission-page';
import { useDomainEvents } from '@/lib/realtime/use-domain-events';
import { useTableFilters } from '@/lib/hooks/use-table-filters';
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
  const { getAccessToken, hasPermission } = useAuth();

  const canAdjust = hasPermission(PERMISSIONS.INVENTORY_STOCK_ADJUST);
  const canListWarehouses = hasPermission(PERMISSIONS.INVENTORY_WAREHOUSE_MANAGE);

  // Explicit type argument: without it, TS infers `lowStock`'s type as the
  // literal `false` (not `boolean`) from the object literal below, which then
  // rejects `setFilter('lowStock', !lowStock)` since `!lowStock` is `boolean`.
  const { filters, setFilter, clearFilters, hasActiveFilters, page, setPage } = useTableFilters<{
    warehouseId: string;
    lowStock: boolean;
  }>({
    warehouseId: '',
    lowStock: false,
  });
  const { warehouseId, lowStock } = filters;

  const [result, setResult] = useState<Paginated<StockItemDto> | null>(null);
  const [warehouses, setWarehouses] = useState<WarehouseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<StockItemDto | null>(null);

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!opts.silent) setLoading(true);
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
        if (!opts.silent) setLoading(false);
      }
    },
    [getAccessToken, warehouseId, lowStock, page],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Signature real-time demo: when ANY stock mutation happens anywhere
  // (another tab/user reserving, adjusting, committing, or releasing stock),
  // silently refresh this grid so on-hand/reserved/available stay live
  // without a manual reload. See apps/api/src/core/event-bus for the
  // publishing side and use-domain-events.ts for the socket handshake.
  const [lastLiveUpdate, setLastLiveUpdate] = useState<Date | null>(null);
  useDomainEvents(
    useCallback(() => {
      setLastLiveUpdate(new Date());
      void load({ silent: true });
    }, [load]),
    'inventory.stock.updated',
  );

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stock levels</h1>
          <p className="text-muted-foreground">
            On-hand, reserved and available quantities per product and warehouse.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground" title="Updates live as stock changes anywhere — no refresh needed">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Live
          {lastLiveUpdate ? (
            <span>· updated {lastLiveUpdate.toLocaleTimeString()}</span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {warehouses.length > 0 ? (
          <select
            value={warehouseId}
            onChange={(e) => setFilter('warehouseId', e.target.value || null)}
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
          onClick={() => setFilter('lowStock', !lowStock)}
        >
          {lowStock ? 'Showing low stock only' : 'Show low stock only'}
        </Button>

        {hasActiveFilters && warehouses.length === 0 ? (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
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
    <RequirePermissionPage permission={PERMISSIONS.INVENTORY_PRODUCT_READ}>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <StockContent />
      </Suspense>
    </RequirePermissionPage>
  );
}
