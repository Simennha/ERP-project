'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  type DataTableColumn,
} from '@erp/ui';
import { PERMISSIONS } from '@erp/contracts';
import { useAuth } from '@/lib/auth/auth-context';
import { useDomainEvents } from '@/lib/realtime/use-domain-events';
import { RequirePermissionPage } from '@/lib/sales/page-guard';
import {
  cancelOrder,
  confirmOrder,
  fulfillOrder,
  getOrder,
  type SalesOrderDetail,
  type SalesOrderLine,
} from '@/lib/sales/api-client';

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
  const { getAccessToken, hasPermission } = useAuth();
  const [order, setOrder] = useState<SalesOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<'confirm' | 'fulfill' | 'cancel' | null>(null);

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

  // Live status refresh: if this order is confirmed/fulfilled/cancelled from
  // another tab (or a workflow automation), reflect it here without a manual
  // reload — same real-time channel the Inventory stock page uses.
  useDomainEvents(
    useCallback(
      (event) => {
        const payload = event.payload as { orderId?: unknown } | null;
        if (payload?.orderId === id) void load();
      },
      [id, load],
    ),
  );

  const canTransition = hasPermission(PERMISSIONS.SALES_ORDER_UPDATE);

  async function runAction(action: 'confirm' | 'fulfill' | 'cancel') {
    setActionError(null);
    setActionPending(action);
    try {
      const fn = action === 'confirm' ? confirmOrder : action === 'fulfill' ? fulfillOrder : cancelOrder;
      setOrder(await fn(getAccessToken(), id));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : `Failed to ${action} order`);
    } finally {
      setActionPending(null);
    }
  }

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

      {canTransition && order.status !== 'fulfilled' && order.status !== 'cancelled' ? (
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {actionError ? (
              <p className="text-sm font-medium text-destructive" role="alert">
                {actionError}
              </p>
            ) : null}
            <div className="flex gap-3">
              {order.status === 'draft' ? (
                <Button
                  onClick={() => void runAction('confirm')}
                  disabled={actionPending !== null}
                >
                  {actionPending === 'confirm' ? 'Confirming…' : 'Confirm (reserve stock)'}
                </Button>
              ) : null}
              {order.status === 'confirmed' ? (
                <Button
                  onClick={() => void runAction('fulfill')}
                  disabled={actionPending !== null}
                >
                  {actionPending === 'fulfill' ? 'Fulfilling…' : 'Fulfill (deduct stock)'}
                </Button>
              ) : null}
              <Button
                variant="outline"
                onClick={() => void runAction('cancel')}
                disabled={actionPending !== null}
              >
                {actionPending === 'cancel' ? 'Cancelling…' : 'Cancel order'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
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
