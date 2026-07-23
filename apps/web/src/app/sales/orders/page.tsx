'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Button,
  DataTable,
  StatusBadge,
  cn,
  type DataTableColumn,
  type StatusTone,
} from '@erp/ui';
import { PERMISSIONS } from '@erp/contracts';
import { useAuth } from '@/lib/auth/auth-context';
import { RequirePermissionPage } from '@/lib/auth/require-permission-page';
import { listOrders, type SalesOrderListItem } from '@/lib/sales/api-client';

const STATUSES = ['draft', 'confirmed', 'fulfilled', 'cancelled'] as const;

const STATUS_TONE: Record<string, StatusTone> = {
  draft: 'neutral',
  confirmed: 'info',
  fulfilled: 'success',
  cancelled: 'danger',
};

function formatMoney(value: string): string {
  const n = Number(value);
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : value;
}

const columns: Array<DataTableColumn<SalesOrderListItem>> = [
  {
    key: 'orderNumber',
    header: 'Order #',
    cell: (o) => (
      <Link href={`/sales/orders/${o.id}`} className="font-medium underline-offset-4 hover:underline">
        {o.orderNumber}
      </Link>
    ),
  },
  { key: 'customer', header: 'Customer', cell: (o) => o.customerName ?? <span className="text-muted-foreground">—</span> },
  {
    key: 'status',
    header: 'Status',
    cell: (o) => <StatusBadge label={o.status} tone={STATUS_TONE[o.status] ?? 'neutral'} />,
  },
  {
    key: 'total',
    header: 'Total',
    className: 'text-right',
    cell: (o) => <span className="tabular-nums">{formatMoney(o.totalAmount)}</span>,
  },
  {
    key: 'orderDate',
    header: 'Date',
    cell: (o) => new Date(o.orderDate).toLocaleDateString(),
  },
];

function OrdersList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getAccessToken } = useAuth();

  const statusParam = searchParams.get('status') ?? '';
  const activeStatus = (STATUSES as readonly string[]).includes(statusParam) ? statusParam : '';

  const [orders, setOrders] = useState<SalesOrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listOrders(getAccessToken(), {
        status: activeStatus || undefined,
        pageSize: 100,
      });
      setOrders(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, activeStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  function setStatus(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set('status', next);
    else params.delete('status');
    const qs = params.toString();
    router.replace(`/sales/orders${qs ? `?${qs}` : ''}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales orders</h1>
          <p className="text-muted-foreground">Draft, confirm, and track customer orders.</p>
        </div>
        <Link href="/sales/orders/new">
          <Button>New order</Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-1">
        <FilterChip label="All" active={activeStatus === ''} onClick={() => setStatus('')} />
        {STATUSES.map((s) => (
          <FilterChip
            key={s}
            label={s.charAt(0).toUpperCase() + s.slice(1)}
            active={activeStatus === s}
            onClick={() => setStatus(s)}
          />
        ))}
      </div>

      {error ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <DataTable
          columns={columns}
          data={orders}
          getRowId={(o) => o.id}
          emptyMessage="No orders match this filter."
        />
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'border px-3 py-1 text-sm transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground',
      )}
    >
      {label}
    </button>
  );
}

export default function OrdersPage() {
  return (
    <RequirePermissionPage permission={PERMISSIONS.SALES_ORDER_READ}>
      {/* useSearchParams requires a Suspense boundary during static rendering. */}
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <OrdersList />
      </Suspense>
    </RequirePermissionPage>
  );
}
