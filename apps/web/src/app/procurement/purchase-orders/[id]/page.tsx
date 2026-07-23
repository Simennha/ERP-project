'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PERMISSIONS } from '@erp/contracts';
import { Button, Card, CardContent, CardHeader, CardTitle, buttonVariants } from '@erp/ui';
import { useAuth } from '@/lib/auth/auth-context';
import {
  deletePurchaseOrder,
  getPurchaseOrder,
  updatePurchaseOrder,
  type PurchaseOrderDto,
} from '@/lib/procurement/api';
import { PurchaseOrderForm, type PurchaseOrderFormValues } from '../purchase-order-form';

/** ISO datetime string -> `YYYY-MM-DD` for a `<input type="date">`, or ''. */
function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}

function toFormValues(purchaseOrder: PurchaseOrderDto): PurchaseOrderFormValues {
  return {
    poNumber: purchaseOrder.poNumber,
    vendorName: purchaseOrder.vendorName,
    status: purchaseOrder.status,
    totalAmount: purchaseOrder.totalAmount,
    orderDate: toDateInputValue(purchaseOrder.orderDate),
    expectedDate: toDateInputValue(purchaseOrder.expectedDate),
    notes: purchaseOrder.notes ?? '',
  };
}

export default function PurchaseOrderDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { getAccessToken, hasPermission } = useAuth();
  const canUpdate = hasPermission(PERMISSIONS.PROCUREMENT_PURCHASE_ORDER_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.PROCUREMENT_PURCHASE_ORDER_DELETE);

  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrderDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPurchaseOrder(await getPurchaseOrder(getAccessToken(), id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load purchase order');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete() {
    if (!window.confirm('Delete this purchase order?')) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await deletePurchaseOrder(getAccessToken(), id);
      router.push('/procurement/purchase-orders');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      setDeleting(false);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  if (error && !purchaseOrder) {
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
        <Link href="/procurement/purchase-orders" className={buttonVariants({ variant: 'outline' })}>
          Back to purchase orders
        </Link>
      </div>
    );
  }

  if (!purchaseOrder) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{purchaseOrder.poNumber}</h1>
          <p className="text-muted-foreground">Vendor: {purchaseOrder.vendorName}</p>
        </div>
        <div className="flex gap-2">
          {canDelete ? (
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{notice}</p> : null}

      {canUpdate ? (
        <PurchaseOrderForm
          key={purchaseOrder.updatedAt}
          initial={toFormValues(purchaseOrder)}
          submitLabel="Save changes"
          onSubmit={async (input) => {
            const updated = await updatePurchaseOrder(getAccessToken(), id, input);
            setPurchaseOrder(updated);
            setNotice('Changes saved.');
          }}
        />
      ) : (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Detail label="Status" value={purchaseOrder.status} />
            <Detail label="Total amount" value={purchaseOrder.totalAmount} />
            <Detail
              label="Order date"
              value={new Date(purchaseOrder.orderDate).toLocaleDateString()}
            />
            <Detail
              label="Expected date"
              value={
                purchaseOrder.expectedDate
                  ? new Date(purchaseOrder.expectedDate).toLocaleDateString()
                  : '—'
              }
            />
            <Detail label="Notes" value={purchaseOrder.notes ?? '—'} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="text-muted-foreground">{label}: </span>
      {value}
    </p>
  );
}
