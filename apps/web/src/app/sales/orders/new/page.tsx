'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@erp/ui';
import { PERMISSIONS } from '@erp/contracts';
import { useAuth } from '@/lib/auth/auth-context';
import { RequirePermissionPage } from '@/lib/sales/page-guard';
import {
  createOrder,
  getAvailability,
  listCustomers,
  listProducts,
  type Availability,
  type Customer,
  type CreateOrderInput,
  type ProductOption,
} from '@/lib/sales/api-client';

const SELECT_CLASS =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

interface LineDraft {
  key: string;
  productId: string;
  quantity: string;
  unitPrice: string;
  availability: Availability | null;
  availabilityLoading: boolean;
}

let lineCounter = 0;
function newLine(): LineDraft {
  lineCounter += 1;
  return {
    key: `line-${lineCounter}`,
    productId: '',
    quantity: '1',
    unitPrice: '',
    availability: null,
    availabilityLoading: false,
  };
}

function lineSubtotal(line: LineDraft): number {
  const qty = Number.parseInt(line.quantity, 10);
  const price = Number.parseFloat(line.unitPrice);
  if (!Number.isFinite(qty) || !Number.isFinite(price)) return 0;
  return qty * price;
}

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function OrderBuilder() {
  const router = useRouter();
  const { getAccessToken } = useAuth();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  // True when the Inventory product-catalog endpoint isn't available yet, so
  // the builder falls back to manual product-id + unit-price entry.
  const [manualProductMode, setManualProductMode] = useState(false);

  const [customerId, setCustomerId] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([newLine()]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingRefs, setLoadingRefs] = useState(true);

  const productById = useMemo(() => {
    const map = new Map<string, ProductOption>();
    for (const p of products) map.set(p.id, p);
    return map;
  }, [products]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = getAccessToken();
      try {
        const cs = await listCustomers(token);
        if (!cancelled) setCustomers(cs);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load customers');
      }
      // Product catalog is owned by Inventory; degrade gracefully if absent.
      try {
        const ps = await listProducts(token);
        if (!cancelled) setProducts(ps);
      } catch {
        if (!cancelled) setManualProductMode(true);
      } finally {
        if (!cancelled) setLoadingRefs(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getAccessToken]);

  const fetchAvailability = useCallback(
    async (key: string, productId: string) => {
      if (!productId) return;
      setLines((prev) =>
        prev.map((l) => (l.key === key ? { ...l, availabilityLoading: true } : l)),
      );
      try {
        const a = await getAvailability(getAccessToken(), productId);
        setLines((prev) =>
          prev.map((l) =>
            l.key === key ? { ...l, availability: a, availabilityLoading: false } : l,
          ),
        );
      } catch {
        setLines((prev) =>
          prev.map((l) =>
            l.key === key ? { ...l, availability: null, availabilityLoading: false } : l,
          ),
        );
      }
    },
    [getAccessToken],
  );

  function updateLine(key: string, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function onSelectProduct(key: string, productId: string) {
    const product = productById.get(productId);
    updateLine(key, {
      productId,
      // Pre-fill unit price from the product's salePrice (editable afterwards).
      unitPrice: product ? product.salePrice : '',
      availability: null,
    });
    void fetchAvailability(key, productId);
  }

  function onManualProductBlur(key: string, productId: string) {
    if (productId) void fetchAvailability(key, productId);
  }

  const total = useMemo(
    () => lines.reduce((sum, l) => sum + lineSubtotal(l), 0),
    [lines],
  );

  const canSubmit =
    customerId !== '' &&
    lines.length > 0 &&
    lines.every(
      (l) =>
        l.productId.trim() !== '' &&
        Number.parseInt(l.quantity, 10) > 0 &&
        Number.isFinite(Number.parseFloat(l.unitPrice)) &&
        Number.parseFloat(l.unitPrice) >= 0,
    );

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    const input: CreateOrderInput = {
      customerId,
      lines: lines.map((l) => ({
        productId: l.productId.trim(),
        quantity: Number.parseInt(l.quantity, 10),
        unitPrice: Number.parseFloat(l.unitPrice),
      })),
    };
    try {
      const created = await createOrder(getAccessToken(), input);
      router.push(`/sales/orders/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create order');
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New sales order</h1>
        <p className="text-muted-foreground">
          Pick a customer, add product lines, and submit. The order is created as a draft.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-md space-y-2">
            <Label htmlFor="customer">Customer</Label>
            <select
              id="customer"
              className={SELECT_CLASS}
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              disabled={loadingRefs}
            >
              <option value="">Select a customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {!loadingRefs && customers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No customers yet — create one first.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Line items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {manualProductMode ? (
            <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              Product catalog endpoint not available yet — enter product IDs
              manually. (Once the Inventory module is merged this becomes a
              product picker.)
            </p>
          ) : null}

          <div className="space-y-3">
            {lines.map((line, index) => {
              const availabilityLabel = line.availabilityLoading
                ? 'Checking…'
                : line.availability
                  ? line.availability.warehouseId
                    ? `${line.availability.available} available`
                    : 'No warehouse configured'
                  : '';
              return (
                <div
                  key={line.key}
                  className="grid grid-cols-1 gap-3 rounded-md border border-border p-3 sm:grid-cols-12 sm:items-end"
                >
                  <div className="space-y-1 sm:col-span-5">
                    <Label htmlFor={`product-${line.key}`}>Product</Label>
                    {manualProductMode ? (
                      <Input
                        id={`product-${line.key}`}
                        placeholder="Product ID"
                        value={line.productId}
                        onChange={(e) => updateLine(line.key, { productId: e.target.value })}
                        onBlur={(e) => onManualProductBlur(line.key, e.target.value.trim())}
                      />
                    ) : (
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
                    )}
                    {availabilityLabel ? (
                      <p className="text-xs text-muted-foreground">{availabilityLabel}</p>
                    ) : null}
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor={`qty-${line.key}`}>Qty</Label>
                    <Input
                      id={`qty-${line.key}`}
                      type="number"
                      min={1}
                      step={1}
                      value={line.quantity}
                      onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor={`price-${line.key}`}>Unit price</Label>
                    <Input
                      id={`price-${line.key}`}
                      type="number"
                      min={0}
                      step="0.01"
                      value={line.unitPrice}
                      onChange={(e) => updateLine(line.key, { unitPrice: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <Label>Subtotal</Label>
                    <p className="flex h-10 items-center text-sm tabular-nums">
                      {formatMoney(lineSubtotal(line))}
                    </p>
                  </div>

                  <div className="sm:col-span-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                      disabled={lines.length === 1}
                      aria-label={`Remove line ${index + 1}`}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <Button type="button" variant="outline" onClick={() => setLines((prev) => [...prev, newLine()])}>
            Add line
          </Button>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between rounded-md border border-border p-4">
        <span className="text-sm text-muted-foreground">Order total</span>
        <span className="text-lg font-semibold tabular-nums">{formatMoney(total)}</span>
      </div>

      {error ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Button onClick={() => void handleSubmit()} disabled={!canSubmit || submitting}>
          {submitting ? 'Creating…' : 'Create draft order'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push('/sales/orders')}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export default function NewOrderPage() {
  return (
    <RequirePermissionPage permission={PERMISSIONS.SALES_ORDER_CREATE}>
      <OrderBuilder />
    </RequirePermissionPage>
  );
}
