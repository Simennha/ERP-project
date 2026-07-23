'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PERMISSIONS } from '@erp/contracts';
import { Button, Label, buttonVariants } from '@erp/ui';
import { useAuth } from '@/lib/auth/auth-context';
import { RequirePermissionPage } from '@/lib/auth/require-permission-page';
import {
  createInvoice,
  listAvailableSalesOrders,
  type AvailableSalesOrderDto,
} from '@/lib/finance/api';

function NewInvoiceContent() {
  const router = useRouter();
  const { getAccessToken } = useAuth();

  const [orders, setOrders] = useState<AvailableSalesOrderDto[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listAvailableSalesOrders(getAccessToken());
      setOrders(data);
      setSelectedOrderId(data[0]?.id ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sales orders');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit() {
    if (!selectedOrderId) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await createInvoice(getAccessToken(), { salesOrderId: selectedOrderId });
      router.push(`/finance/invoices/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invoice');
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New invoice</h1>
        <p className="text-muted-foreground">
          Pick a sales order to invoice. The invoice number and amount are generated
          automatically from the order.
        </p>
      </div>

      {error ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : orders.length === 0 ? (
        <div className="space-y-3">
          <p className="text-muted-foreground">No uninvoiced sales orders available.</p>
          <Link href="/sales/orders" className={buttonVariants({ variant: 'outline' })}>
            Go to sales orders
          </Link>
        </div>
      ) : (
        <div className="max-w-xl space-y-4">
          <div className="space-y-2">
            <Label htmlFor="salesOrder">Sales order</Label>
            <select
              id="salesOrder"
              value={selectedOrderId}
              onChange={(e) => setSelectedOrderId(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.orderNumber} — {order.customerName} — ${order.totalAmount}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSubmit} disabled={submitting || !selectedOrderId}>
              {submitting ? 'Creating…' : 'Create invoice'}
            </Button>
            <Link href="/finance/invoices" className={buttonVariants({ variant: 'ghost' })}>
              Cancel
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NewInvoicePage() {
  return (
    <RequirePermissionPage permission={PERMISSIONS.FINANCE_INVOICE_CREATE}>
      <NewInvoiceContent />
    </RequirePermissionPage>
  );
}
