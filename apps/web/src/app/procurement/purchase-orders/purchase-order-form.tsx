'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@erp/ui';
import { useAuth } from '@/lib/auth/auth-context';
import { listProducts, listWarehouses, type ProductDto, type WarehouseDto } from '@/lib/inventory/api';
import type { CreatePurchaseOrderInput, PurchaseOrderLineInput } from '@/lib/procurement/api';

const SELECT_CLASS =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

export interface PurchaseOrderLineDraft {
  key: string;
  productId: string;
  warehouseId: string;
  quantityOrdered: string;
  unitCost: string;
}

export interface PurchaseOrderFormValues {
  poNumber: string;
  vendorName: string;
  orderDate: string;
  expectedDate: string;
  notes: string;
  lines: PurchaseOrderLineDraft[];
}

let lineCounter = 0;
function newLine(): PurchaseOrderLineDraft {
  lineCounter += 1;
  return { key: `line-${lineCounter}`, productId: '', warehouseId: '', quantityOrdered: '1', unitCost: '' };
}

const EMPTY: PurchaseOrderFormValues = {
  poNumber: '',
  vendorName: '',
  orderDate: '',
  expectedDate: '',
  notes: '',
  lines: [newLine()],
};

function lineSubtotal(line: PurchaseOrderLineDraft): number {
  const qty = Number.parseInt(line.quantityOrdered, 10);
  const cost = Number.parseFloat(line.unitCost);
  if (!Number.isFinite(qty) || !Number.isFinite(cost)) return 0;
  return qty * cost;
}

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Create/edit form for a PurchaseOrder + its PurchaseOrderLine items — the
 * inbound mirror of Sales's order builder (`app/sales/orders/new/page.tsx`).
 * Used by both the "New purchase order" page and the PO detail page (only
 * while the PO is 'draft' — lines are immutable once submitted). The parent
 * supplies `onSubmit`, which performs the actual API call and navigation;
 * this component owns local field state, product/warehouse lookups, and
 * client-side validation.
 */
export function PurchaseOrderForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: Partial<PurchaseOrderFormValues>;
  submitLabel: string;
  onSubmit: (input: CreatePurchaseOrderInput) => Promise<void>;
}) {
  const { getAccessToken } = useAuth();
  const [values, setValues] = useState<PurchaseOrderFormValues>({ ...EMPTY, ...initial, lines: initial?.lines ?? EMPTY.lines });
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseDto[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const productById = useMemo(() => {
    const map = new Map<string, ProductDto>();
    for (const p of products) map.set(p.id, p);
    return map;
  }, [products]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = getAccessToken();
      try {
        const [productPage, warehousePage] = await Promise.all([
          listProducts(token, { pageSize: 100 }),
          listWarehouses(token, { pageSize: 100 }),
        ]);
        if (!cancelled) {
          setProducts(productPage.data);
          setWarehouses(warehousePage.data);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load products/warehouses');
      } finally {
        if (!cancelled) setLoadingRefs(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getAccessToken]);

  function set<K extends keyof PurchaseOrderFormValues>(key: K, value: PurchaseOrderFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function updateLine(key: string, patch: Partial<PurchaseOrderLineDraft>) {
    setValues((prev) => ({
      ...prev,
      lines: prev.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    }));
  }

  function onSelectProduct(key: string, productId: string) {
    const product = productById.get(productId);
    updateLine(key, {
      productId,
      // Pre-fill unit cost from the product's costPrice (editable afterwards).
      unitCost: product ? product.costPrice : '',
    });
  }

  const total = useMemo(
    () => values.lines.reduce((sum, l) => sum + lineSubtotal(l), 0),
    [values.lines],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    let lines: PurchaseOrderLineInput[];
    try {
      if (!values.poNumber.trim()) throw new Error('PO number is required');
      if (!values.vendorName.trim()) throw new Error('Vendor name is required');
      if (values.lines.length === 0) throw new Error('Add at least one line');

      lines = values.lines.map((l) => {
        if (!l.productId) throw new Error('Every line needs a product');
        if (!l.warehouseId) throw new Error('Every line needs a warehouse');
        const quantityOrdered = Number.parseInt(l.quantityOrdered, 10);
        if (!Number.isFinite(quantityOrdered) || quantityOrdered <= 0) {
          throw new Error('Quantity must be a whole number greater than zero');
        }
        const unitCost = Number.parseFloat(l.unitCost);
        if (!Number.isFinite(unitCost) || unitCost < 0) {
          throw new Error('Unit cost must be a number of zero or greater');
        }
        return { productId: l.productId, warehouseId: l.warehouseId, quantityOrdered, unitCost };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid input');
      return;
    }

    const input: CreatePurchaseOrderInput = {
      poNumber: values.poNumber.trim(),
      vendorName: values.vendorName.trim(),
      orderDate: values.orderDate || undefined,
      expectedDate: values.expectedDate || undefined,
      notes: values.notes.trim() || undefined,
      lines,
    };

    setSubmitting(true);
    try {
      await onSubmit(input);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Purchase order</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="poNumber">PO number</Label>
              <Input
                id="poNumber"
                value={values.poNumber}
                onChange={(e) => set('poNumber', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendorName">Vendor name</Label>
              <Input
                id="vendorName"
                value={values.vendorName}
                onChange={(e) => set('vendorName', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="orderDate">Order date</Label>
              <Input
                id="orderDate"
                type="date"
                value={values.orderDate}
                onChange={(e) => set('orderDate', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expectedDate">Expected date</Label>
              <Input
                id="expectedDate"
                type="date"
                value={values.expectedDate}
                onChange={(e) => set('expectedDate', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" value={values.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Line items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {values.lines.map((line, index) => (
              <div
                key={line.key}
                className="grid grid-cols-1 gap-3 rounded-md border border-border p-3 sm:grid-cols-12 sm:items-end"
              >
                <div className="space-y-1 sm:col-span-4">
                  <Label htmlFor={`product-${line.key}`}>Product</Label>
                  <select
                    id={`product-${line.key}`}
                    className={SELECT_CLASS}
                    value={line.productId}
                    onChange={(e) => onSelectProduct(line.key, e.target.value)}
                    disabled={loadingRefs}
                  >
                    <option value="">Select a product…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} — {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1 sm:col-span-3">
                  <Label htmlFor={`warehouse-${line.key}`}>Warehouse</Label>
                  <select
                    id={`warehouse-${line.key}`}
                    className={SELECT_CLASS}
                    value={line.warehouseId}
                    onChange={(e) => updateLine(line.key, { warehouseId: e.target.value })}
                    disabled={loadingRefs}
                  >
                    <option value="">Select a warehouse…</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1 sm:col-span-1">
                  <Label htmlFor={`qty-${line.key}`}>Qty</Label>
                  <Input
                    id={`qty-${line.key}`}
                    type="number"
                    min={1}
                    step={1}
                    value={line.quantityOrdered}
                    onChange={(e) => updateLine(line.key, { quantityOrdered: e.target.value })}
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor={`cost-${line.key}`}>Unit cost</Label>
                  <Input
                    id={`cost-${line.key}`}
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.unitCost}
                    onChange={(e) => updateLine(line.key, { unitCost: e.target.value })}
                  />
                </div>

                <div className="space-y-1 sm:col-span-1">
                  <Label>Subtotal</Label>
                  <p className="flex h-10 items-center text-sm tabular-nums">{formatMoney(lineSubtotal(line))}</p>
                </div>

                <div className="sm:col-span-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setValues((prev) => ({ ...prev, lines: prev.lines.filter((l) => l.key !== line.key) }))
                    }
                    disabled={values.lines.length === 1}
                    aria-label={`Remove line ${index + 1}`}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => setValues((prev) => ({ ...prev, lines: [...prev.lines, newLine()] }))}
          >
            Add line
          </Button>

          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-lg font-semibold tabular-nums">{formatMoney(total)}</span>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={submitting}>
        {submitting ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}
