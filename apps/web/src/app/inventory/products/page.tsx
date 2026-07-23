'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { PERMISSIONS } from '@erp/contracts';
import { Button, DataTable, Input, Label, buttonVariants, type DataTableColumn } from '@erp/ui';
import { useAuth } from '@/lib/auth/auth-context';
import { listProducts, type Paginated, type ProductDto } from '@/lib/inventory/api';

const PAGE_SIZE = 25;

export default function ProductsPage() {
  const { getAccessToken, hasPermission } = useAuth();
  const canCreate = hasPermission(PERMISSIONS.INVENTORY_PRODUCT_CREATE);

  const [result, setResult] = useState<Paginated<ProductDto> | null>(null);
  const [category, setCategory] = useState('');
  const [appliedCategory, setAppliedCategory] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listProducts(getAccessToken(), {
        category: appliedCategory || undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, appliedCategory, page]);

  useEffect(() => {
    void load();
  }, [load]);

  function applyFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setAppliedCategory(category.trim());
  }

  const columns: Array<DataTableColumn<ProductDto>> = [
    {
      key: 'sku',
      header: 'SKU',
      cell: (row) => <code className="text-xs">{row.sku}</code>,
    },
    {
      key: 'name',
      header: 'Name',
      cell: (row) => (
        <Link href={`/inventory/products/${row.id}`} className="font-medium hover:underline">
          {row.name}
        </Link>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      cell: (row) => row.category ?? <span className="text-muted-foreground">—</span>,
    },
    { key: 'uom', header: 'UoM', cell: (row) => row.uom },
    {
      key: 'costPrice',
      header: 'Cost',
      className: 'text-right tabular-nums',
      cell: (row) => row.costPrice,
    },
    {
      key: 'salePrice',
      header: 'Sale',
      className: 'text-right tabular-nums',
      cell: (row) => row.salePrice,
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
      key: 'movements',
      header: '',
      className: 'text-right',
      cell: (row) => (
        <Link
          href={`/inventory/stock/${row.id}/movements`}
          className="text-sm text-muted-foreground hover:underline"
        >
          Movements
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground">Catalog of products in your company.</p>
        </div>
        {canCreate ? (
          <Link href="/inventory/products/new" className={buttonVariants()}>
            New Product
          </Link>
        ) : null}
      </div>

      <form onSubmit={applyFilter} className="flex items-end gap-2">
        <div className="space-y-2">
          <Label htmlFor="category">Filter by category</Label>
          <Input
            id="category"
            placeholder="e.g. Beverages"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-64"
          />
        </div>
        <Button type="submit" variant="secondary">
          Apply
        </Button>
        {appliedCategory ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setCategory('');
              setAppliedCategory('');
              setPage(1);
            }}
          >
            Clear
          </Button>
        ) : null}
      </form>

      {error ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <DataTable
        columns={columns}
        data={result?.data ?? []}
        getRowId={(row) => row.id}
        emptyMessage={loading ? 'Loading…' : 'No products found'}
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
