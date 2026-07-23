'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PERMISSIONS } from '@erp/contracts';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  Input,
  Label,
  StatusBadge,
  buttonVariants,
  type DataTableColumn,
  type StatusTone,
} from '@erp/ui';
import { useAuth } from '@/lib/auth/auth-context';
import { useDomainEvents } from '@/lib/realtime/use-domain-events';
import { RequirePermissionPage } from '@/lib/auth/require-permission-page';
import {
  cancelPurchaseOrder,
  deletePurchaseOrder,
  getPurchaseOrder,
  receivePurchaseOrder,
  submitPurchaseOrder,
  updatePurchaseOrder,
  type PurchaseOrderDto,
  type PurchaseOrderLineDto,
} from '@/lib/procurement/api';
import { PurchaseOrderForm, type PurchaseOrderFormValues } from '../purchase-order-form';

const STATUS_TONE: Record<string, StatusTone> = {
  draft: 'neutral',
  submitted: 'info',
  partiallyReceived: 'warning',
  received: 'success',
  cancelled: 'danger',
};

function formatMoney(value: string): string {
  const n = Number(value);
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : value;
}

/** ISO datetime string -> `YYYY-MM-DD` for an `<input type="date">`, or ''. */
function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}

function toFormValues(purchaseOrder: PurchaseOrderDto): PurchaseOrderFormValues {
  return {
    poNumber: purchaseOrder.poNumber,
    vendorName: purchaseOrder.vendorName,
    orderDate: toDateInputValue(purchaseOrder.orderDate),
    expectedDate: toDateInputValue(purchaseOrder.expectedDate),
    notes: purchaseOrder.notes ?? '',
    lines: purchaseOrder.lines.map((line, index) => ({
      key: `existing-${index}`,
      productId: line.productId,
      warehouseId: line.warehouseId,
      quantityOrdered: String(line.quantityOrdered),
      unitCost: line.unitCost,
    })),
  };
}

const lineColumns: Array<DataTableColumn<PurchaseOrderLineDto>> = [
  { key: 'sku', header: 'SKU', cell: (l) => <span className="font-mono text-xs">{l.productSku}</span> },
  { key: 'product', header: 'Product', cell: (l) => l.productName || l.productId },
  { key: 'warehouse', header: 'Warehouse', cell: (l) => l.warehouseName || l.warehouseId },
  { key: 'ordered', header: 'Ordered', className: 'text-right', cell: (l) => <span className="tabular-nums">{l.quantityOrdered}</span> },
  { key: 'received', header: 'Received', className: 'text-right', cell: (l) => <span className="tabular-nums">{l.quantityReceived}</span> },
  { key: 'unitCost', header: 'Unit cost', className: 'text-right', cell: (l) => <span className="tabular-nums">{formatMoney(l.unitCost)}</span> },
  { key: 'lineTotal', header: 'Line total', className: 'text-right', cell: (l) => <span className="tabular-nums">{formatMoney(l.lineTotal)}</span> },
];

/**
 * Per-line "how many arrived just now" input table, shown while the PO is
 * 'submitted' or 'partiallyReceived'. Only lines with remaining > 0 are
 * listed — a fully-received line has nothing left to enter. Submits every
 * non-empty, non-zero entry in one `POST .../receive` call (partial receipt
 * across multiple lines in one trip, or just one line at a time — both work).
 */
function ReceiveLines({
  lines,
  onReceive,
}: {
  lines: PurchaseOrderLineDto[];
  onReceive: (entries: Array<{ lineId: string; quantityReceived: number }>) => Promise<void>;
}) {
  const receivable = useMemo(
    () => lines.filter((l) => l.quantityReceived < l.quantityOrdered),
    [lines],
  );
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    const entries: Array<{ lineId: string; quantityReceived: number }> = [];
    for (const line of receivable) {
      const raw = amounts[line.id];
      if (!raw) continue;
      const quantityReceived = Number.parseInt(raw, 10);
      if (!Number.isFinite(quantityReceived) || quantityReceived <= 0) continue;
      const remaining = line.quantityOrdered - line.quantityReceived;
      if (quantityReceived > remaining) {
        setError(`${line.productSku}: cannot receive ${quantityReceived}, only ${remaining} remaining`);
        return;
      }
      entries.push({ lineId: line.id, quantityReceived });
    }
    if (entries.length === 0) {
      setError('Enter a quantity for at least one line');
      return;
    }
    setSubmitting(true);
    try {
      await onReceive(entries);
      setAmounts({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to receive goods');
    } finally {
      setSubmitting(false);
    }
  }

  if (receivable.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Receive goods</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {receivable.map((line) => {
            const remaining = line.quantityOrdered - line.quantityReceived;
            return (
              <div
                key={line.id}
                className="grid grid-cols-1 gap-3 rounded-md border border-border p-3 sm:grid-cols-12 sm:items-end"
              >
                <div className="sm:col-span-5">
                  <p className="text-sm font-medium">{line.productName || line.productSku}</p>
                  <p className="text-xs text-muted-foreground">
                    {line.productSku} @ {line.warehouseName}
                  </p>
                </div>
                <div className="sm:col-span-3">
                  <p className="text-sm text-muted-foreground">
                    {line.quantityReceived} of {line.quantityOrdered} received
                  </p>
                </div>
                <div className="space-y-1 sm:col-span-4">
                  <Label htmlFor={`receive-${line.id}`}>Receive now (max {remaining})</Label>
                  <Input
                    id={`receive-${line.id}`}
                    type="number"
                    min={0}
                    max={remaining}
                    step={1}
                    placeholder="0"
                    value={amounts[line.id] ?? ''}
                    onChange={(e) => setAmounts((prev) => ({ ...prev, [line.id]: e.target.value }))}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {error ? (
          <p className="text-sm font-medium text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <Button onClick={() => void handleSubmit()} disabled={submitting}>
          {submitting ? 'Receiving…' : 'Receive'}
        </Button>
      </CardContent>
    </Card>
  );
}

function PurchaseOrderDetailContent() {
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
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<'submit' | 'cancel' | null>(null);

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

  // Live status refresh: if this PO is submitted/received/cancelled from
  // another tab (or a workflow automation), reflect it here without a manual
  // reload — same real-time channel Sales's order detail page uses.
  useDomainEvents(
    useCallback(
      (event) => {
        const payload = event.payload as { purchaseOrderId?: unknown } | null;
        if (payload?.purchaseOrderId === id) void load();
      },
      [id, load],
    ),
  );

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

  async function runAction(action: 'submit' | 'cancel') {
    setActionError(null);
    setActionPending(action);
    try {
      const fn = action === 'submit' ? submitPurchaseOrder : cancelPurchaseOrder;
      setPurchaseOrder(await fn(getAccessToken(), id));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : `Failed to ${action} purchase order`);
    } finally {
      setActionPending(null);
    }
  }

  async function handleReceive(entries: Array<{ lineId: string; quantityReceived: number }>) {
    const updated = await receivePurchaseOrder(getAccessToken(), id, { lines: entries });
    setPurchaseOrder(updated);
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

  const isDraft = purchaseOrder.status === 'draft';
  const canReceive = purchaseOrder.status === 'submitted' || purchaseOrder.status === 'partiallyReceived';
  const canCancel = purchaseOrder.status === 'draft' || purchaseOrder.status === 'submitted';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{purchaseOrder.poNumber}</h1>
            <StatusBadge label={purchaseOrder.status} tone={STATUS_TONE[purchaseOrder.status] ?? 'neutral'} />
          </div>
          <p className="text-muted-foreground">Vendor: {purchaseOrder.vendorName}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/procurement/purchase-orders" className={buttonVariants({ variant: 'outline' })}>
            Back to purchase orders
          </Link>
          {canDelete && isDraft ? (
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

      {canUpdate && isDraft ? (
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
        <>
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>
                <span className="text-muted-foreground">Total amount: </span>
                {formatMoney(purchaseOrder.totalAmount)}
              </p>
              <p>
                <span className="text-muted-foreground">Order date: </span>
                {new Date(purchaseOrder.orderDate).toLocaleDateString()}
              </p>
              <p>
                <span className="text-muted-foreground">Expected date: </span>
                {purchaseOrder.expectedDate ? new Date(purchaseOrder.expectedDate).toLocaleDateString() : '—'}
              </p>
              <p>
                <span className="text-muted-foreground">Notes: </span>
                {purchaseOrder.notes ?? '—'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Line items</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={lineColumns}
                data={purchaseOrder.lines}
                getRowId={(l) => l.id}
                emptyMessage="No line items."
              />
            </CardContent>
          </Card>
        </>
      )}

      {canUpdate && (isDraft || canCancel) ? (
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
              {isDraft ? (
                <Button onClick={() => void runAction('submit')} disabled={actionPending !== null}>
                  {actionPending === 'submit' ? 'Submitting…' : 'Submit to vendor'}
                </Button>
              ) : null}
              {canCancel ? (
                <Button
                  variant="outline"
                  onClick={() => void runAction('cancel')}
                  disabled={actionPending !== null}
                >
                  {actionPending === 'cancel' ? 'Cancelling…' : 'Cancel order'}
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {canUpdate && canReceive ? (
        <ReceiveLines lines={purchaseOrder.lines} onReceive={handleReceive} />
      ) : null}
    </div>
  );
}

export default function PurchaseOrderDetailPage() {
  return (
    <RequirePermissionPage permission={PERMISSIONS.PROCUREMENT_PURCHASE_ORDER_READ}>
      <PurchaseOrderDetailContent />
    </RequirePermissionPage>
  );
}
