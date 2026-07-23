'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Button, DataTable, buttonVariants, type DataTableColumn } from '@erp/ui';
import { useAuth } from '@/lib/auth/auth-context';
import {
  getProduct,
  listMovements,
  type Paginated,
  type ProductDto,
  type StockMovementDto,
} from '@/lib/inventory/api';

const PAGE_SIZE = 25;

function MovementsContent() {
  const params = useParams<{ productId: string }>();
  const productId = params.productId;
  const searchParams = useSearchParams();
  const warehouseId = searchParams.get('warehouseId') ?? '';
  const { getAccessToken } = useAuth();

  const [result, setResult] = useState<Paginated<StockMovementDto> | null>(null);
  const [product, setProduct] = useState<ProductDto | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [warehouseId, productId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(
        await listMovements(getAccessToken(), productId, {
          warehouseId: warehouseId || undefined,
          page,
          pageSize: PAGE_SIZE,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load movements');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, productId, warehouseId, page]);

  useEffect(() => {
    void load();
  }, [load]);

  // Best-effort: show the product name in the header.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const p = await getProduct(getAccessToken(), productId);
        if (!cancelled) setProduct(p);
      } catch {
        // Non-fatal — the movements table still renders.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getAccessToken, productId]);

  const columns: Array<DataTableColumn<StockMovementDto>> = [
    {
      key: 'createdAt',
      header: 'When',
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {new Date(row.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      cell: (row) => <span className="text-sm font-medium capitalize">{row.type}</span>,
    },
    {
      key: 'quantity',
      header: 'Quantity',
      className: 'text-right tabular-nums',
      cell: (row) => (
        <span
          className={
            row.quantity < 0
              ? 'text-destructive'
              : 'text-emerald-600 dark:text-emerald-400'
          }
        >
          {row.quantity > 0 ? `+${row.quantity}` : row.quantity}
        </span>
      ),
    },
    { key: 'warehouse', header: 'Warehouse', cell: (row) => row.warehouseName },
    {
      key: 'reason',
      header: 'Reason',
      cell: (row) => row.reason ?? <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'reference',
      header: 'Reference',
      cell: (row) =>
        row.referenceType ? (
          <span className="text-xs text-muted-foreground">
            {row.referenceType}
            {row.referenceId ? ` · ${row.referenceId}` : ''}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Movement history</h1>
          <p className="text-muted-foreground">
            {product ? (
              <>
                {product.name} (<code>{product.sku}</code>)
              </>
            ) : (
              <>Product <code>{productId}</code></>
            )}
            {warehouseId ? ' · one warehouse' : ' · all warehouses'}
          </p>
        </div>
        <Link
          href={
            warehouseId ? `/inventory/stock?warehouseId=${warehouseId}` : '/inventory/stock'
          }
          className={buttonVariants({ variant: 'outline' })}
        >
          Back to stock
        </Link>
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
        emptyMessage={loading ? 'Loading…' : 'No movements recorded'}
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

export default function MovementsPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
      <MovementsContent />
    </Suspense>
  );
}
