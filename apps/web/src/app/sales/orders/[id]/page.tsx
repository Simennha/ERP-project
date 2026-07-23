'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  type DataTableColumn,
} from '@erp/ui';
import { PERMISSIONS } from '@erp/contracts';
import { useAuth } from '@/lib/auth/auth-context';
import { RequirePermissionPage } from '@/lib/sales/page-guard';
import { getOrder, type SalesOrderDetail, type SalesOrderLine } from '@/lib/sales/api-client';

function formatMoney(value: string): string {
  const n = Number(value);
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : value;
}

const lineColumns: Array<DataTableColumn<SalesOrderLine>> = [
  { key: 'sku', header: 'SKU', cell: (l) => <span className="font-mono text-xs">{l.productSku}</span> },
  { key: 'product', header: 'Product', cell: (l) => l.productName || l.productId },
  { key: 'qty', header: 'Qty', className: 'text-right', cell: (l) => <span className="tabular-nums">{l.quantity}</span> },
  {
    key: 'unitPrice',
    header: 'Unit price',
    className: 'text-right',
    cell: (l) => <span className="tabular-nums">{formatMoney(l.unitPrice)}</span>,
  },
  {
    key: 'lineTotal',
    header: 'Line total',
    className: 'text-right',
    cell: (l) => <span className="tabular-nums">{formatMoney(l.lineTotal)}</span>,
  },
];

function OrderDetail({ id }: { id: string }) {
  const { getAccessToken } = useAuth();
  const [order, setOrder] = useState<SalesOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOrder(await getOrder(getAccessToken(), id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="text-muted-foreground">Loading…</p>;
  }
  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
        <Link href="/sales/orders" className="text-sm underline underline-offset-4">
          Back to orders
        </Link>
      </div>
    );
  }
  if (!order) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{order.orderNumber}</h1>
            <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium capitalize">
              {order.status}
            </span>
          </div>
          <p className="text-muted-foreground">
            Ordered {new Date(order.orderDate).toLocaleString()}
          </p>
        </div>
        <Link href="/sales/orders" className="text-sm underline underline-offset-4">
          Back to orders
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p className="font-medium">{order.customer?.name ?? '—'}</p>
          {order.customer?.email ? (
            <p className="text-muted-foreground">{order.customer.email}</p>
          ) : null}
          {order.customer?.phone ? (
            <p className="text-muted-foreground">{order.customer.phone}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Line items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <DataTable
            columns={lineColumns}
            data={order.lines}
            getRowId={(l) => l.id}
            emptyMessage="No line items."
          />
          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-lg font-semibold tabular-nums">
              {formatMoney(order.totalAmount)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/*
        No confirm / fulfill / cancel actions here: those status transitions do
        not exist server-side yet (deliberately a separate integration step).
      */}
    </div>
  );
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  return (
    <RequirePermissionPage permission={PERMISSIONS.SALES_ORDER_READ}>
      <OrderDetail id={id} />
    </RequirePermissionPage>
  );
}
